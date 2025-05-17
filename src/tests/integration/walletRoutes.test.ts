import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../../app";
import { User } from "../../models/User";
import Wallet from "../../models/Wallet";
import { generateToken } from "../../utils/jwt";

let mongoServer: MongoMemoryServer;
let testUser: any;
let authToken: string;

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
  await Wallet.deleteMany({});

  // Créer un utilisateur de test
  testUser = new User({
    email: "wallet-api-test@example.com",
    password: "password123",
    authMethod: "email",
    firstName: "Test",
    lastName: "User",
    userReferralCode: "FLEX-ABC123", // Format correct : FLEX- suivi de 6 caractères
    verificationCode: "FLEX-TEST01",
    formFullfilled: false,
    wallets: [],
    kycStatus: "pending",
  });
  await testUser.save();

  // Générer un token d'authentification
  authToken = generateToken(testUser);
});

describe("Wallet API", () => {
  it("should create a new wallet", async () => {
    const res = await request(app)
      .post("/api/wallet/create")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("publicKey");
    expect(res.body.data.type).toBe("created");
  });

  it("should retrieve user wallets", async () => {
    // Créer un wallet d'abord
    await request(app)
      .post("/api/wallet/create")
      .set("Authorization", `Bearer ${authToken}`);

    const res = await request(app)
      .get("/api/wallet")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBe(1);
  });

  it("should require authentication", async () => {
    const res = await request(app).post("/api/wallet/create");

    expect(res.status).toBe(401);
  });
});
