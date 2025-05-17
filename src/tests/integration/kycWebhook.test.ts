import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../../app";
import KYC from "../../models/KYC";
import type { UserDocument } from "../../models/User";
import { User } from "../../models/User";

jest.mock("../../utils/logger");
jest.mock("../../utils/eventEmitter");
jest.mock("../../utils/kycUtils", () => ({
  generateWebhookSignature: jest.fn().mockReturnValue("valid-signature"),
  verifyWebhookSignature: jest.fn().mockImplementation((payload, signature) => {
    return signature === "valid-signature";
  }),
}));

describe("KYC Webhook API", () => {
  let userId: mongoose.Types.ObjectId;
  let kycId: mongoose.Types.ObjectId;
  let mongoServer: MongoMemoryServer;
  const providerReference = "KULIPA-TEST-12345";

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create test user and KYC record
    const user: UserDocument = await User.create({
      email: "webhook-test@example.com",
      password: "password123",
      firstName: "Webhook",
      lastName: "Test",
      authMethod: "email",
      kycStatus: "pending",
      userReferralCode: "FLEX-ABC123",
      formFullfilled: false,
      wallets: [],
      verificationCode: "FLEX-TEST01",
    });

    userId = user._id as mongoose.Types.ObjectId;

    const kyc = await KYC.create({
      userId,
      status: "pending",
      providerReference,
      submissionData: {
        firstName: "Webhook",
        lastName: "Test",
        dateOfBirth: "1990-01-01",
      },
    });

    kycId = kyc._id;

    // Update user with KYC ID
    await User.findByIdAndUpdate(userId, { kycId: kycId.toString() });
  });

  afterAll(async () => {
    // Clean up test data
    await KYC.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("should process valid KYC approval webhook", async () => {
    const webhookPayload = {
      reference: providerReference,
      status: "approved",
      verification_data: {
        fullName: "Webhook Test",
        documentNumber: "AB123456",
        verifiedAt: new Date().toISOString(),
      },
    };

    const response = await request(app)
      .post("/api/kyc/webhook")
      .set("x-kulipa-signature", "valid-signature")
      .send(webhookPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    // Verify KYC record was updated
    const updatedKyc = await KYC.findById(kycId);
    expect(updatedKyc).not.toBeNull();
    expect(updatedKyc?.status).toBe("approved");
    expect(updatedKyc?.responseData).toEqual(webhookPayload.verification_data);

    // Verify user KYC status was updated
    const updatedUser = await User.findById(userId);
    expect(updatedUser).not.toBeNull();
    expect(updatedUser?.kycStatus).toBe("approved");
  });

  it("should reject webhook with invalid signature", async () => {
    const webhookPayload = {
      reference: providerReference,
      status: "rejected",
      verification_data: {
        reason: "Document expired",
      },
    };

    const response = await request(app)
      .post("/api/kyc/webhook")
      .set("x-kulipa-signature", "invalid-signature")
      .send(webhookPayload);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);

    // Verify KYC record was not updated
    const kyc = await KYC.findById(kycId);
    expect(kyc?.status).not.toBe("rejected");
  });

  it("should return 400 for invalid webhook payload", async () => {
    // Missing required fields
    const invalidPayload = {
      reference: providerReference,
      // status is missing
    };

    const response = await request(app)
      .post("/api/kyc/webhook")
      .set("x-kulipa-signature", "valid-signature")
      .send(invalidPayload);

    expect(response.status).toBe(400);
  });

  it("should return 404 for non-existent provider reference", async () => {
    const webhookPayload = {
      reference: "NON-EXISTENT-REFERENCE",
      status: "approved",
      verification_data: {},
    };

    const response = await request(app)
      .post("/api/kyc/webhook")
      .set("x-kulipa-signature", "valid-signature")
      .send(webhookPayload);

    // Should return 200 even for errors to acknowledge receipt
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain("not found");
  });
});
