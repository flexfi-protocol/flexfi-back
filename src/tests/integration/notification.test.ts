import express from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import NotificationModel, { NotificationType } from "../../models/Notification";
import { User } from "../../models/User";
import * as notificationService from "../../services/notificationService";
import { eventEmitter, EventType } from "../../utils/eventEmitter";

// Create a minimal test server with the notification routes
const app = express();
app.use(express.json());

// Simple mock auth middleware for testing
app.use((req: any, res: any, next: any) => {
  if (req.headers.authorization) {
    const userId = req.headers.authorization.split(" ")[1];
    req.user = { _id: userId };
  }
  next();
});

// Mock notification endpoints
app.get("/api/notifications", async (req: any, res: any) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { notifications, total } =
      await notificationService.getUserNotifications(userId, 20, 0, false);

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: { total, limit: 20, offset: 0 },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch notifications" });
  }
});

app.get("/api/notifications/unread/count", async (req: any, res: any) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { total } = await notificationService.getUserNotifications(
      userId,
      0,
      0,
      true
    );
    res.status(200).json({ success: true, count: total });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch unread count" });
  }
});

app.put("/api/notifications/:id/read", async (req: any, res: any) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const notification = await notificationService.markNotificationAsRead(
      req.params.id,
      userId
    );
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ success: false, error: "Failed to mark as read" });
  }
});

app.put("/api/notifications/read-all", async (req: any, res: any) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const count = await notificationService.markAllNotificationsAsRead(userId);
    res.status(200).json({ success: true, count });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to mark all as read" });
  }
});

describe("Notification System Integration Test", () => {
  let mongoServer: MongoMemoryServer;
  let testUser: import("../../models/User").UserDocument;
  let userId: string;

  beforeAll(async () => {
    jest.setTimeout(60000); // Increase timeout for MongoDB setup

    // Set up in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect directly to the in-memory database
    await mongoose.connect(mongoUri);
    console.log("Connected to in-memory MongoDB server");

    // Create a test user
    testUser = await User.create({
      email: "test@example.com",
      password: "hashedPassword123",
      firstName: "Test",
      lastName: "User",
      authMethod: "email",
      wallets: [
        {
          publicKey: "0xTestWalletAddress",
          type: "created",
          hasDelegation: false,
        },
      ],
      kycStatus: "none",
      userReferralCode: "NOTIF123",
      formFullfilled: false,
      verificationCode: "FLEX-NOTIF1",
    });

    userId = (testUser._id as mongoose.Types.ObjectId).toString();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear notifications before each test
    await NotificationModel.deleteMany({});
  });

  test("KYC status change creates a notification and can be accessed through API", async () => {
    // 1. Create a notification directly through the service
    await notificationService.createNotification(
      userId,
      NotificationType.KYC_APPROVED,
      "Your KYC verification has been approved. You now have full access to FlexFi services.",
      { status: "approved" }
    );

    // 2. Verify notification was created in the database
    const notifications = await NotificationModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      type: NotificationType.KYC_APPROVED,
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].message).toBe(
      "Your KYC verification has been approved. You now have full access to FlexFi services."
    );

    // 3. Verify API returns the notification
    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${userId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBe(1);
    expect(response.body.data[0].type).toBe(NotificationType.KYC_APPROVED);

    // 4. Mark notification as read through API
    const markReadResponse = await request(app)
      .put(`/api/notifications/${notifications[0]._id}/read`)
      .set("Authorization", `Bearer ${userId}`)
      .expect(200);

    expect(markReadResponse.body.success).toBe(true);

    // 5. Verify notification is now marked as read
    const updatedNotification = await NotificationModel.findById(
      notifications[0]._id
    );
    expect(updatedNotification?.read).toBe(true);

    // 6. Check unread count API
    const unreadCountResponse = await request(app)
      .get("/api/notifications/unread/count")
      .set("Authorization", `Bearer ${userId}`)
      .expect(200);

    expect(unreadCountResponse.body.success).toBe(true);
    expect(unreadCountResponse.body.count).toBe(0);
  });

  test("Event system creates notifications for different event types", async () => {
    // 1. Emit a KYC status change event
    eventEmitter.emitEvent(EventType.KYC_STATUS_CHANGED, userId, {
      status: "approved",
    });

    // 2. Emit a transaction completed event
    eventEmitter.emitEvent(EventType.TRANSACTION_COMPLETED, userId, {
      amount: "100",
      currency: "USDC",
      transactionId: "tx123",
    });

    // Wait for async event processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 3. Verify notifications for both event types were created
    const allNotifications = await NotificationModel.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).sort({ createdAt: -1 });

    // Should have at least 2 notifications
    expect(allNotifications.length).toBeGreaterThanOrEqual(2);

    // 4. Verify API returns all notifications
    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${userId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThanOrEqual(2);

    // 5. Mark all as read
    const markAllReadResponse = await request(app)
      .put("/api/notifications/read-all")
      .set("Authorization", `Bearer ${userId}`)
      .expect(200);

    expect(markAllReadResponse.body.success).toBe(true);

    // 6. Verify all are marked as read (unread count is 0)
    const unreadCount = await NotificationModel.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      read: false,
    });
    expect(unreadCount).toBe(0);
  });
});
