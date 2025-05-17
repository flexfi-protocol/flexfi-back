import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { User, UserDocument } from "../../models/User";
import authService from "../../services/authService";
import userService from "../../services/userService";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe("UserService", () => {
  it("should create a new user", async () => {
    const { user: mockUser } = (await authService.registerWithEmail(
      "test@example.com",
      "password123",
      "Test",
      "User",
      undefined,
      true
    )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };

    const foundUser = await userService.getUserById(mockUser._id.toString());
    expect(foundUser).not.toBeNull();
    expect(foundUser?.email).toBe("test@example.com");
  });

  it("should get a user by email", async () => {
    const { user: mockUser } = (await authService.registerWithEmail(
      "test@example.com",
      "password123",
      "Test",
      "User",
      undefined,
      true
    )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };

    const foundUser = (await userService.getUserByEmail(
      "test@example.com"
    )) as UserDocument & { _id: mongoose.Types.ObjectId };
    expect(foundUser).not.toBeNull();
    expect(foundUser?._id.toString()).toBe(mockUser._id.toString());
  });

  it("should update a user", async () => {
    const { user: mockUser } = (await authService.registerWithEmail(
      "test@example.com",
      "password123",
      "Test",
      "User",
      undefined,
      true
    )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };

    const updatedUser = await userService.updateUser(mockUser._id.toString(), {
      firstName: "Updated",
      lastName: "Name",
    });

    expect(updatedUser).not.toBeNull();
    expect(updatedUser?.firstName).toBe("Updated");
    expect(updatedUser?.lastName).toBe("Name");
  });
});
