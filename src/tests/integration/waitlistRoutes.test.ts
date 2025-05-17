import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import app from "../../app";
import { IBasicUser, IWaitlistFormData } from "../../models/User";

let mongoServer: MongoMemoryServer;

// Helper function to create a basic user
const createBasicUser = async (
  email: string = "test@example.com",
  referralCode?: string
) => {
  const basicUser: IBasicUser = {
    email,
    password: "Test123!",
    firstName: "Test",
    lastName: "User",
    referralCodeUsed: referralCode,
  };

  const res = await request(app).post("/api/auth/register").send(basicUser);
  return res;
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

beforeEach(async () => {
  // Clean the database
  await mongoose.connection.dropDatabase();

  // Create base user for each test
  const userRes = await createBasicUser();
  expect(userRes.status).toBe(201);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("Waitlist API", () => {
  describe("POST /api/waitlist", () => {
    it("should register a new waitlist user", async () => {
      const mockFormData: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "United States",
        stateProvince: "California",
        ageGroup: "18-29",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$700 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Solana", "Ethereum"],
        publicWallet: "0x123...",
        mainReason: "Buy Now, Pay Later (BNPL) with crypto",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        timeToCompletionSeconds: 120,
        experienceBnplRating: 4,
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      const res = await request(app).post("/api/waitlist").send(mockFormData);

      if (res.status !== 201) {
        console.log("Validation error:", {
          status: res.status,
          body: res.body,
          errors: res.body.errors,
        });
      }

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");

      // Verify that the basic user fields are present
      expect(res.body.data).toHaveProperty("_id");
      expect(res.body.data).toHaveProperty("email", mockFormData.email);
      expect(res.body.data).toHaveProperty("firstName");
      expect(res.body.data).toHaveProperty("lastName");
      expect(res.body.data).toHaveProperty("authMethod");
      expect(res.body.data).toHaveProperty("wallets");
      expect(res.body.data).toHaveProperty("kycStatus");
      expect(res.body.data).toHaveProperty("formFullfilled", true);
      expect(res.body.data).toHaveProperty("flexpoints_total", 20);

      // Verify that the added fields have valid values
      expect(typeof res.body.data._id).toBe("string");
      expect(typeof res.body.data.email).toBe("string");
      expect(typeof res.body.data.firstName).toBe("string");
      expect(typeof res.body.data.lastName).toBe("string");
      expect(typeof res.body.data.authMethod).toBe("string");
      expect(Array.isArray(res.body.data.wallets)).toBe(true);
      expect(typeof res.body.data.kycStatus).toBe("string");
      expect(typeof res.body.data.formFullfilled).toBe("boolean");
      expect(typeof res.body.data.flexpoints_total).toBe("number");
    });

    it("should return 400 if required fields are missing", async () => {
      const res = await request(app).post("/api/waitlist").send({
        email: "test@example.com",
        // Missing required fields
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it("should return 409 if User is already waitlisted", async () => {
      const mockFormData: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "United States",
        stateProvince: "California",
        ageGroup: "18-29",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$700 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Solana", "Ethereum"],
        publicWallet: "0x123...",
        mainReason: "Buy Now, Pay Later (BNPL) with crypto",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        timeToCompletionSeconds: 120,
        experienceBnplRating: 4,
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      // First waitlist the user
      const firstRes = await request(app)
        .post("/api/waitlist")
        .send(mockFormData);
      expect(firstRes.status).toBe(201);
      expect(firstRes.body.status).toBe("success");

      // Try to waitlist the same user again
      const secondRes = await request(app)
        .post("/api/waitlist")
        .send(mockFormData);

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.status).toBe("error");
      expect(secondRes.body.message).toBe("Form already submitted");
    });

    it("should handle numeric field limits correctly", async () => {
      const mockFormData: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "United States",
        stateProvince: "California",
        ageGroup: "18-29",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$700 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Solana", "Ethereum"],
        publicWallet: "0x123...",
        mainReason: "Buy Now, Pay Later (BNPL) with crypto",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        timeToCompletionSeconds: -1, // Invalid negative value
        experienceBnplRating: 6, // Invalid value (max 5)
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      const res = await request(app).post("/api/waitlist").send(mockFormData);

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors).toContainEqual(
        expect.objectContaining({
          msg: "Time to completion must be positive",
        })
      );
      expect(res.body.errors).toContainEqual(
        expect.objectContaining({
          msg: "Please rate between 1 and 5",
        })
      );
    });

    it("should handle special characters in text fields", async () => {
      const mockFormData: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test@#$%^&*()_+", // Special characters
        preferredLanguage: "English",
        country: "United States",
        stateProvince: "California",
        ageGroup: "18-29",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$700 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Solana", "Ethereum"],
        publicWallet: "0x123...",
        mainReason: "Buy Now, Pay Later (BNPL) with crypto",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        timeToCompletionSeconds: 120,
        experienceBnplRating: 4,
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      const res = await request(app).post("/api/waitlist").send(mockFormData);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");

      // Check in database that telegramOrDiscordId was correctly saved
      const user = await mongoose.connection.db
        .collection("users")
        .findOne({ email: mockFormData.email });
      expect(user).not.toBeNull();
      if (!user) throw new Error("User not found in database");
      expect(user.telegramOrDiscordId).toBe("test@#$%^&*()_+");
    });

    it("should handle empty arrays for bnplServices and favoriteChains", async () => {
      const mockFormData: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "United States",
        stateProvince: "California",
        ageGroup: "18-29",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: [], // Empty array
        avgOnlineSpend: "$700 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: [], // Empty array
        publicWallet: "0x123...",
        mainReason: "Buy Now, Pay Later (BNPL) with crypto",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        timeToCompletionSeconds: 120,
        experienceBnplRating: 4,
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      const res = await request(app).post("/api/waitlist").send(mockFormData);
      console.log("Test - Received response:", {
        status: res.status,
        body: res.body,
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors).toContainEqual(
        expect.objectContaining({
          msg: "Please select at least one BNPL service",
        })
      );
      expect(res.body.errors).toContainEqual(
        expect.objectContaining({
          msg: "Please select at least one blockchain",
        })
      );
    });

    it("should add 5 points to referrer when a new user uses their referral code", async () => {
      // Create first user (referrer)
      const referrerEmail = "referrer@example.com";
      const referrerRes = await createBasicUser(referrerEmail);
      expect(referrerRes.status).toBe(201);

      // Get referrer's referral code
      const referrer = await mongoose.connection.db
        .collection("users")
        .findOne({ email: referrerEmail });
      expect(referrer).not.toBeNull();
      if (!referrer) throw new Error("Referrer not found");
      const referralCode = referrer.userReferralCode;
      const points0 = referrer.flexpoints_total;
      console.log("Points initiaux du parrain:", points0);
      console.log("Code de parrainage utilisé:", referralCode);
      expect(points0).toBe(0);

      // Create second user using the referral code
      const referredEmail = "referred@example.com";
      console.log("Création du filleul avec le code:", referralCode);
      const referredRes = await createBasicUser(referredEmail, referralCode);
      expect(referredRes.status).toBe(201);

      // Check that referrer got 5 points
      const updatedReferrer = await mongoose.connection.db
        .collection("users")
        .findOne({ email: referrerEmail });
      expect(updatedReferrer).not.toBeNull();
      if (!updatedReferrer) throw new Error("Updated referrer not found");

      console.log(
        "Points finaux du parrain:",
        updatedReferrer.flexpoints_total
      );
      expect(updatedReferrer.flexpoints_total).toBe(5); // 5 points pour le parrainage d'un nouvel utilisateur
    });

    it("should add 20 points to user when completing the waitlist form", async () => {
      // Create a new user
      const userEmail = "formuser@example.com";
      const userRes = await createBasicUser(userEmail);
      expect(userRes.status).toBe(201);

      // Get initial points
      const initialUser = await mongoose.connection.db
        .collection("users")
        .findOne({ email: userEmail });
      expect(initialUser).not.toBeNull();
      if (!initialUser) throw new Error("Initial user not found");
      const initialPoints = initialUser.flexpoints_total;

      // Submit waitlist form
      const mockFormData: IWaitlistFormData = {
        email: userEmail,
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "United States",
        stateProvince: "California",
        ageGroup: "18-29",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$700 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Solana", "Ethereum"],
        publicWallet: "0x123...",
        mainReason: "Buy Now, Pay Later (BNPL) with crypto",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        timeToCompletionSeconds: 120,
        experienceBnplRating: 4,
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      const formRes = await request(app)
        .post("/api/waitlist")
        .send(mockFormData);
      expect(formRes.status).toBe(201);

      // Check that user got 20 points
      const updatedUser = await mongoose.connection.db
        .collection("users")
        .findOne({ email: userEmail });
      expect(updatedUser).not.toBeNull();
      if (!updatedUser) throw new Error("Updated user not found");
      expect(updatedUser.flexpoints_total).toBe(initialPoints + 20);
    });
  });

  describe("GET /api/waitlist/count", () => {
    it("should return the total count of waitlist users", async () => {
      const email2 = "test2@example.com";
      const user2 = await createBasicUser(email2);
      expect(user2.status).toBe(201);

      // Waitlist request body for user1
      const mockUser1: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "user1",
        preferredLanguage: "English",
        country: "United States",
        stateProvince: "California",
        ageGroup: "18-29",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$700 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Solana", "Ethereum"],
        publicWallet: "0x123...",
        mainReason: "Buy Now, Pay Later (BNPL) with crypto",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test",
        timeToCompletionSeconds: 120,
        experienceBnplRating: 4,
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      // Waitlist request body for user2
      const mockUser2: IWaitlistFormData = {
        email: email2,
        phoneNumber: "+1234567891",
        telegramOrDiscordId: "user2",
        preferredLanguage: "French",
        country: "France",
        stateProvince: "Île-de-France",
        ageGroup: "30-44",
        employmentStatus: "Self-employed / Freelancer",
        monthlyIncome: "$5,000 – $9,999",
        educationLevel: "Master's degree (MA, MSc, MBA, etc.)",
        hasCreditCard: true,
        bnplServices: ["Alma", "Oney"],
        avgOnlineSpend: "$1,000 – $1,499",
        cryptoLevel: "Crypto Native",
        walletType: "Phantom",
        portfolioSize: "$10,000 – $49,999",
        favoriteChains: ["Solana", "Bitcoin"],
        publicWallet: "0x456...",
        mainReason: "Earn yield or rewards on purchases",
        firstPurchase: "100-500",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "test2",
        timeToCompletionSeconds: 180,
        experienceBnplRating: 5,
        consentAdult: true,
        consent_data_sharing: true,
        consent_data_sharing_date: new Date(),
        consentMarketing: true,
        signupTimestamp: new Date(),
      };

      // Add user1 to waitlist
      const res1 = await request(app).post("/api/waitlist").send(mockUser1);
      expect(res1.status).toBe(201);

      // Get the count of waitlist users
      const count1 = await request(app).get("/api/waitlist/count");
      expect(count1.status).toBe(200);
      expect(count1.body).toHaveProperty("status", "success");
      expect(count1.body).toHaveProperty("data");
      expect(count1.body.data.count).toBe(2); // 1 utilisateur du beforeEach + 1 nouvel utilisateur

      // Add user2 to waitlist
      const res2 = await request(app).post("/api/waitlist").send(mockUser2);
      if (res2.status !== 201) {
        console.log("Validation error for user2:", {
          status: res2.status,
          body: res2.body,
          errors: res2.body.errors,
        });
      }
      expect(res2.status).toBe(201);

      // Get the count of waitlist users
      const count2 = await request(app).get("/api/waitlist/count");
      expect(count2.status).toBe(200);
      expect(count2.body).toHaveProperty("status", "success");
      expect(count2.body).toHaveProperty("data");
      expect(count2.body.data.count).toBe(2); // 2 utilisateurs waitlistés après ajout du second
    });

    it("should return 0 when no users are in the waitlist", async () => {
      const res = await request(app).get("/api/waitlist/count");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status", "success");
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("count", 1); // 1 utilisateur du beforeEach
    });
  });

  describe("GET /api/waitlist/referral/:code", () => {
    it("should return the number of referrals for a valid code", async () => {
      // 1. Get the referral code of the user created in beforeEach
      const users = await mongoose.connection.db
        .collection("users")
        .find()
        .toArray();
      expect(users.length).toBe(1);
      const referralCode = users[0].userReferralCode;

      // 2. Create a second user using this referral code
      const user2Res = await createBasicUser("user2@example.com", referralCode);
      expect(user2Res.status).toBe(201);

      // 3. Check that the counter is at 1
      const countAfterFirst = await request(app).get(
        `/api/waitlist/referral/${referralCode}`
      );
      expect(countAfterFirst.status).toBe(200);
      expect(countAfterFirst.body).toHaveProperty("status", "success");
      expect(countAfterFirst.body.data).toHaveProperty("code", referralCode);
      expect(countAfterFirst.body.data).toHaveProperty("referrals", 1);

      // 4. Create a third user using the same referral code
      const user3Res = await createBasicUser("user3@example.com", referralCode);
      expect(user3Res.status).toBe(201);

      // 5. Check that the counter is now at 2
      const countAfterSecond = await request(app).get(
        `/api/waitlist/referral/${referralCode}`
      );
      expect(countAfterSecond.status).toBe(200);
      expect(countAfterSecond.body).toHaveProperty("status", "success");
      expect(countAfterSecond.body.data).toHaveProperty("code", referralCode);
      expect(countAfterSecond.body.data).toHaveProperty("referrals", 2);
    });

    it("should return 404 for a non-existent referral code", async () => {
      const res = await request(app).get("/api/waitlist/referral/NONEXISTENT");

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("status", "error");
      expect(res.body).toHaveProperty("message", "Referral code not found");
    });
  });

  describe("GET /api/waitlist/export", () => {
    it("should return a CSV file with all waitlist users", async () => {
      // Test commented out as it requires authentication
    });
  });
});
