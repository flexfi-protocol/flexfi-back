// Exemple pour walletService.test.ts
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { UserDocument } from "../../models/User";
import Wallet from "../../models/Wallet";
import authService from "../../services/authService";
import walletService from "../../services/walletService";

let mongoServer: MongoMemoryServer;
let testUserId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  // Créer un utilisateur de test via le service d'authentification
  const { user } = (await authService.registerWithEmail(
    "wallet-test@example.com",
    "password123",
    undefined,
    undefined,
    undefined,
    true // isVerified = true pour éviter les problèmes de vérification
  )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };
  testUserId = user._id.toString();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Wallet.deleteMany({});
});

describe("WalletService", () => {
  it("should create a new wallet for a user", async () => {
    const wallet = await walletService.createWallet(testUserId);

    expect(wallet).not.toBeNull();
    expect(wallet.userId.toString()).toBe(testUserId);
    expect(wallet.type).toBe("created");
    expect(wallet.publicKey).toBeTruthy();
    expect(wallet.encryptedPrivateKey).toBeTruthy();
  });

  it("should connect an existing wallet to a user", async () => {
    const publicKey = "FakePublicKey123456789";

    const wallet = await walletService.connectWallet(testUserId, publicKey);

    expect(wallet).not.toBeNull();
    expect(wallet.userId.toString()).toBe(testUserId);
    expect(wallet.type).toBe("connected");
    expect(wallet.publicKey).toBe(publicKey);
    expect(wallet.encryptedPrivateKey).toBeUndefined();
  });

  it("should retrieve all wallets for a user", async () => {
    // Créer quelques wallets pour le test
    await walletService.createWallet(testUserId);
    await walletService.connectWallet(testUserId, "FakePublicKey123");

    const wallets = await walletService.getUserWallets(testUserId);

    expect(wallets.length).toBe(2);
    expect(wallets[0].userId.toString()).toBe(testUserId);
    expect(wallets[1].userId.toString()).toBe(testUserId);
  });
});
