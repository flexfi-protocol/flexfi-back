import fs from "fs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  IWaitlistFormData,
  IWaitlistUser,
  User,
  UserDocument,
} from "../../models/User";
import authService from "../../services/authService";
import waitlistService from "../../services/waitlistService";
import { AppError } from "../../utils/AppError";

let mongoServer: MongoMemoryServer;

// Setup MongoDB in-memory server before tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
  await User.createIndexes();
});

// Clean up after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear database before each test
beforeEach(async () => {
  await User.deleteMany({});
});

describe("WaitlistService", () => {
  describe("registerFormInfos", () => {
    it("should register waitlist information for a user", async () => {
      // Créer un utilisateur de base via le service d'authentification
      const { user: basicUser } = (await authService.registerWithEmail(
        "test@example.com",
        "password123",
        "Test",
        "User",
        undefined,
        true
      )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };

      // Simuler les données reçues par le controller
      const formData: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "CA",
        stateProvince: "CA",
        ageGroup: "25-34",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$500 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Ethereum", "Solana"],
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

      // Simuler la transformation du controller
      const { email, ...formDataWithoutEmail } = formData;
      const userData: IWaitlistUser = {
        email,
        formData: formDataWithoutEmail,
      };

      const user = await waitlistService.registerFormInfos(userData);

      // Vérifier la réponse comme le controller
      expect(user).toBeDefined();
      expect(user.formFullfilled).toBe(true);
      expect(user.flexpoints_native).toBe(20); // 20 points for completing the form
      expect(user.flexpoints_total).toBe(20); // Total should be sum of native and zealy points
      expect(user.email).toBe(formData.email);
      expect(user.firstName).toBe(basicUser.firstName);
      expect(user.lastName).toBe(basicUser.lastName);
      expect(user.authMethod).toBe(basicUser.authMethod);
      expect(user.wallets).toEqual(basicUser.wallets);
      expect(user.kycStatus).toBe(basicUser.kycStatus);
    });

    it("should throw error if user does not exist", async () => {
      const formData: IWaitlistFormData = {
        email: "nonexistent@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "CA",
        stateProvince: "CA",
        ageGroup: "25-34",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$500 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Ethereum", "Solana"],
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

      const { email, ...formDataWithoutEmail } = formData;
      const userData: IWaitlistUser = {
        email,
        formData: formDataWithoutEmail,
      };

      await expect(waitlistService.registerFormInfos(userData)).rejects.toThrow(
        "User not found"
      );
    });

    it("should throw error if form is already submitted", async () => {
      // Créer un utilisateur avec formFullfilled à true via le service
      const { user } = (await authService.registerWithEmail(
        "test@example.com",
        "password123",
        "Test",
        "User",
        undefined,
        true
      )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };
      // Mettre à jour formFullfilled à true et points à 20
      user.formFullfilled = true;
      user.flexpoints_native = 20;
      await user.save();

      const formData: IWaitlistFormData = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        telegramOrDiscordId: "test123",
        preferredLanguage: "English",
        country: "CA",
        stateProvince: "CA",
        ageGroup: "25-34",
        employmentStatus: "Employed – Full-time",
        monthlyIncome: "$3,000 – $4,999",
        educationLevel: "Bachelor's degree (BA, BS, etc.)",
        hasCreditCard: true,
        bnplServices: ["Klarna", "Afterpay"],
        avgOnlineSpend: "$500 – $999",
        cryptoLevel: "Intermediate",
        walletType: "Metamask",
        portfolioSize: "$1,000 – $9,999",
        favoriteChains: ["Ethereum", "Solana"],
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

      const { email, ...formDataWithoutEmail } = formData;
      const userData: IWaitlistUser = {
        email,
        formData: formDataWithoutEmail,
      };

      await expect(waitlistService.registerFormInfos(userData)).rejects.toThrow(
        "Form already submitted"
      );
    });
    it("should throw error when form data is incomplete", async () => {
      // Créer un utilisateur de base via le service d'authentification
      const { user: basicUser } = (await authService.registerWithEmail(
        "test@example.com",
        "password123",
        "Test",
        "User",
        undefined,
        true
      )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };

      // Simuler des données incomplètes
      const formData: Partial<IWaitlistFormData> = {
        email: "test@example.com",
        phoneNumber: "+1234567890",
        // Manque plusieurs champs requis
      };

      const { email, ...formDataWithoutEmail } = formData;
      const userData: IWaitlistUser = {
        email: email!,
        formData: formDataWithoutEmail as any,
      };

      const result = await waitlistService.registerFormInfos(userData);
      expect(result).toBeDefined();
      expect(result.formFullfilled).toBe(true);
      expect(result.flexpoints_native).toBe(20);
      expect(result.flexpoints_total).toBe(20);
      expect(result.email).toBe("test@example.com");
    });
  });

  describe("getWaitlistCount", () => {
    it("should return correct count of users with completed forms", async () => {
      // Créer les utilisateurs via le service d'authentification
      const users = [
        {
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          userReferralCode: "USER1",
        },
        {
          email: "user2@example.com",
          firstName: "User",
          lastName: "Two",
          userReferralCode: "USER2",
        },
        {
          email: "user3@example.com",
          firstName: "User",
          lastName: "Three",
          userReferralCode: "USER3",
        },
      ];
      for (const u of users) {
        const { user } = (await authService.registerWithEmail(
          u.email,
          "password123",
          u.firstName,
          u.lastName,
          undefined,
          true
        )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };
        // Pour user1 et user3, on remplit le formulaire
        if (u.email !== "user2@example.com") {
          user.formFullfilled = true;
          user.flexpoints_native = 20;
          await user.save();
        }
      }
      const count = await waitlistService.getWaitlistCount();
      expect(count).toBe(3);
    });

    it("should throw error when database connection fails", async () => {
      await mongoose.disconnect();

      try {
        await waitlistService.getWaitlistCount();
        fail("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(500);
      }

      await mongoose.connect(mongoServer.getUri());
    });
  });

  describe("exportWaitlistToCSV", () => {
    it("should export waitlist data to CSV", async () => {
      // Créer les utilisateurs via le service d'authentification
      const users = [
        {
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          userReferralCode: "USER1",
          phoneNumber: "+1234567890",
          preferredLanguage: "English",
          country: "US",
        },
        {
          email: "user2@example.com",
          firstName: "User",
          lastName: "Two",
          userReferralCode: "USER2",
          phoneNumber: "+0987654321",
          preferredLanguage: "French",
          country: "FR",
        },
      ];
      for (const u of users) {
        const { user } = (await authService.registerWithEmail(
          u.email,
          "password123",
          u.firstName,
          u.lastName,
          undefined,
          true
        )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };
        user.formFullfilled = true;
        user.flexpoints_native = 20;
        await user.save();
        if (u.phoneNumber) user.phoneNumber = u.phoneNumber;
        if (u.preferredLanguage) user.preferredLanguage = u.preferredLanguage;
        if (u.country) user.country = u.country;
        await user.save();
      }
      const result = await waitlistService.exportWaitlistToCSV();
      expect(result).toHaveProperty("path");
      expect(result).toHaveProperty("filename");
      expect(result.filename).toMatch(/^waitlist_\d{4}-\d{2}-\d{2}\.csv$/);
    });

    it("should handle empty waitlist", async () => {
      const { path: filePath } = await waitlistService.exportWaitlistToCSV();

      expect(fs.existsSync(filePath)).toBe(true);

      const fileContent = fs.readFileSync(filePath, "utf-8");
      expect(fileContent).toContain("email");
      expect(fileContent).toContain("firstName");
      expect(fileContent).toContain("lastName");
      expect(fileContent).toContain("phoneNumber");

      fs.unlinkSync(filePath);
    });

    it("should handle special characters in CSV export", async () => {
      // Créer un utilisateur avec caractères spéciaux via le service
      const { user } = (await authService.registerWithEmail(
        "test@example.com",
        "Test123!@#$%",
        "Jean-François",
        "Dupont",
        undefined,
        true
      )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };
      user.formFullfilled = true;
      user.flexpoints_native = 20;
      await user.save();
      user.phoneNumber = "+1234567890";
      user.preferredLanguage = "French";
      user.country = "CA";
      user.stateProvince = "Québec";
      user.ipCity = "Montréal";
      user.ageGroup = "25-34";
      user.employmentStatus = "Employed – Full-time";
      user.monthlyIncome = "$3,000 – $4,999";
      user.educationLevel = "Bachelor's degree";
      user.hasCreditCard = true;
      user.bnplServices = ["Klarna"];
      user.avgOnlineSpend = "$500 – $999";
      user.cryptoLevel = "Intermediate";
      user.walletType = "Metamask";
      user.portfolioSize = "$1,000 – $9,999";
      user.favoriteChains = ["Ethereum"];
      user.mainReason = "Buy Now, Pay Later (BNPL) with crypto";
      user.utmSource = "google";
      user.utmMedium = "cpc";
      user.utmCampaign = "test";
      user.timeToCompletionSeconds = 120;
      user.experienceBnplRating = 4;
      user.consentAdult = true;
      user.consent_data_sharing = true;
      user.consent_data_sharing_date = new Date();
      user.consentMarketing = true;
      user.signupTimestamp = new Date();
      await user.save();

      const { path: filePath } = await waitlistService.exportWaitlistToCSV();
      const csvContent = fs.readFileSync(filePath, "utf-8");

      expect(csvContent.toLowerCase()).toContain("jean-françois");
      expect(csvContent.toLowerCase()).toContain("dupont");
      expect(csvContent.toLowerCase()).toContain("québec");
      expect(csvContent.toLowerCase()).toContain("montréal");

      fs.unlinkSync(filePath);
    });

    it("should handle empty values in CSV export", async () => {
      // Créer un utilisateur minimal via le service
      const { user } = (await authService.registerWithEmail(
        "test@example.com",
        "Test123!@#$%",
        "Test",
        "User",
        undefined,
        true
      )) as { user: UserDocument & { _id: mongoose.Types.ObjectId } };
      user.formFullfilled = true;
      user.flexpoints_native = 20;
      await user.save();

      const { path: filePath } = await waitlistService.exportWaitlistToCSV();
      const csvContent = fs.readFileSync(filePath, "utf-8");

      const lines = csvContent.split("\n");
      const headers = lines[0].split(",");

      const values: string[] = [];
      let currentValue = "";
      let inQuotes = false;

      for (let i = 0; i < lines[1].length; i++) {
        const char = lines[1][i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(currentValue);
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue);

      const csvData = headers.reduce((acc, header, index) => {
        acc[header] = values[index];
        return acc;
      }, {} as Record<string, string>);

      expect(csvData.referralCodeUsed).toBe("");
      expect(csvData.userReferralCode).toMatch(/^FLEX-/);
      expect(csvData.email).toBe("test@example.com");
      expect(csvData.firstName.toLowerCase()).toBe("test");
      expect(csvData.phoneNumber).toBe("");

      fs.unlinkSync(filePath);
    });
  });
});
