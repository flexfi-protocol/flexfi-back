import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  IUserDataToExport,
  IWaitlistUser,
  User,
  UserDocument,
} from "../models/User";
import { ConflictError, InternalError, NotFoundError } from "../utils/AppError";

dotenv.config();

// Directory to store CSV files
const EXPORT_DIR = path.join(__dirname, "../../exports");

// Function to create a simple CSV
function createCsv(headers: string[], data: any[]): string {
  const headerRow = headers.join(",");
  const rows = data.map((row) =>
    headers
      .map((header) => {
        const value = row[header] || "";
        // If value contains a comma, wrap it in quotes
        return typeof value === "string" && value.includes(",")
          ? `"${value}"`
          : value;
      })
      .join(",")
  );

  return [headerRow, ...rows].join("\n");
}

export class WaitlistService {
  // Register a new user in the waitlist
  async registerFormInfos(userData: IWaitlistUser): Promise<UserDocument> {
    try {
      const user = await User.findOne({ email: userData.email });

      if (!user) {
        throw NotFoundError("User not found");
      }

      if (user.formFullfilled) {
        throw ConflictError("Form already submitted");
      }

      const updatedUser = await User.findOneAndUpdate(
        { email: userData.email },
        {
          $set: {
            phoneNumber: userData.formData.phoneNumber,
            telegramOrDiscordId: userData.formData.telegramOrDiscordId,
            preferredLanguage: userData.formData.preferredLanguage,
            country: userData.formData.country,
            stateProvince: userData.formData.stateProvince,
            ageGroup: userData.formData.ageGroup,
            employmentStatus: userData.formData.employmentStatus,
            monthlyIncome: userData.formData.monthlyIncome,
            educationLevel: userData.formData.educationLevel,
            hasCreditCard: userData.formData.hasCreditCard,
            bnplServices: userData.formData.bnplServices,
            avgOnlineSpend: userData.formData.avgOnlineSpend,
            cryptoLevel: userData.formData.cryptoLevel,
            walletType: userData.formData.walletType,
            portfolioSize: userData.formData.portfolioSize,
            favoriteChains: userData.formData.favoriteChains,
            publicWallet: userData.formData.publicWallet,
            mainReason: userData.formData.mainReason,
            firstPurchase: userData.formData.firstPurchase,
            utmSource: userData.formData.utmSource,
            utmMedium: userData.formData.utmMedium,
            utmCampaign: userData.formData.utmCampaign,
            timeToCompletionSeconds: userData.formData.timeToCompletionSeconds,
            experienceBnplRating: userData.formData.experienceBnplRating,
            consentAdult: userData.formData.consentAdult,
            consent_data_sharing: userData.formData.consent_data_sharing,
            consent_data_sharing_date:
              userData.formData.consent_data_sharing_date,
            consentMarketing: userData.formData.consentMarketing,
            signupTimestamp: userData.formData.signupTimestamp,
            formFullfilled: true,
          },
        },
        { new: true }
      );

      if (!updatedUser) {
        throw InternalError("Failed to update user");
      }

      // Ajouter les points natifs et récupérer l'utilisateur mis à jour
      const finalUser = await updatedUser.addNativePoints(20);
      return finalUser;
    } catch (error: any) {
      throw error;
    }
  }

  // Get total number of users in the waitlist
  async getWaitlistCount(): Promise<number> {
    try {
      return await User.countDocuments();
    } catch (error) {
      throw InternalError("Failed to get waitlist count");
    }
  }

  // Get number of referrals linked to a code
  async getReferralCount(referralCode: string): Promise<number> {
    try {
      // Vérifier d'abord si le code existe
      const userWithCode = await User.findOne({
        userReferralCode: referralCode.toUpperCase(),
      });
      if (!userWithCode) {
        throw NotFoundError("Referral code not found");
      }

      const count = await User.countDocuments({
        referralCodeUsed: referralCode.toUpperCase(),
      });
      return count;
    } catch (error: unknown) {
      console.error("Error fetching referral count:", error);
      if (error instanceof Error) {
        throw error;
      }
      throw InternalError("Failed to fetch referral count");
    }
  }

  // Export waitlist to CSV file
  async exportWaitlistToCSV(): Promise<{ path: string; filename: string }> {
    try {
      if (!fs.existsSync(EXPORT_DIR)) {
        fs.mkdirSync(EXPORT_DIR, { recursive: true });
      }

      const users = await User.find().lean<IUserDataToExport[]>();
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `waitlist_${dateStr}.csv`;
      const filePath = path.join(EXPORT_DIR, filename);

      const headers = [
        "email",
        "password",
        "firstName",
        "lastName",
        "referralCodeUsed",
        "userReferralCode",
        "authMethod",
        "googleId",
        "appleId",
        "twitterId",
        "wallets",
        "kycStatus",
        "kycId",
        "selectedCard",
        "formFullfilled",
        "points",
        "landingVariant",
        "deviceType",
        "browser",
        "ipCity",
        "deviceLocale",
        "phoneNumber",
        "telegramOrDiscordId",
        "preferredLanguage",
        "country",
        "stateProvince",
        "ageGroup",
        "employmentStatus",
        "monthlyIncome",
        "educationLevel",
        "hasCreditCard",
        "bnplServices",
        "avgOnlineSpend",
        "cryptoLevel",
        "walletType",
        "portfolioSize",
        "favoriteChains",
        "publicWallet",
        "mainReason",
        "firstPurchase",
        "utmSource",
        "utmMedium",
        "utmCampaign",
        "timeToCompletionSeconds",
        "experienceBnplRating",
        "consentAdult",
        "consent_data_sharing",
        "consent_data_sharing_date",
        "consentMarketing",
        "signupTimestamp",
        "createdAt",
        "updatedAt",
      ];

      const formattedData = users.map((user) => {
        const formattedUser: Record<string, string> = {};

        headers.forEach((header) => {
          formattedUser[header] = "";
        });

        if (user.bnplServices)
          formattedUser.bnplServices = user.bnplServices.join(", ");
        if (user.favoriteChains)
          formattedUser.favoriteChains = user.favoriteChains.join(", ");
        if (user.wallets)
          formattedUser.wallets = user.wallets
            .map((w) => w.publicKey)
            .join(", ");
        if (user.signupTimestamp)
          formattedUser.signupTimestamp = user.signupTimestamp.toISOString();
        if (user.consent_data_sharing_date)
          formattedUser.consent_data_sharing_date =
            user.consent_data_sharing_date.toISOString();
        if (user.createdAt)
          formattedUser.createdAt = user.createdAt.toISOString();
        if (user.updatedAt)
          formattedUser.updatedAt = user.updatedAt.toISOString();
        if (user.timeToCompletionSeconds)
          formattedUser.timeToCompletionSeconds =
            user.timeToCompletionSeconds.toString();
        if (user.experienceBnplRating)
          formattedUser.experienceBnplRating =
            user.experienceBnplRating.toString();
        if (user.points) formattedUser.points = user.points.toString();
        if (user.hasCreditCard !== undefined)
          formattedUser.hasCreditCard = user.hasCreditCard.toString();
        if (user.consentAdult !== undefined)
          formattedUser.consentAdult = user.consentAdult.toString();
        if (user.consent_data_sharing !== undefined)
          formattedUser.consent_data_sharing =
            user.consent_data_sharing.toString();
        if (user.consentMarketing !== undefined)
          formattedUser.consentMarketing = user.consentMarketing.toString();
        if (user.formFullfilled !== undefined)
          formattedUser.formFullfilled = user.formFullfilled.toString();
        if (user.kycStatus) formattedUser.kycStatus = user.kycStatus.toString();

        Object.entries(user).forEach(([key, value]) => {
          if (
            ![
              "bnplServices",
              "favoriteChains",
              "wallets",
              "signupTimestamp",
              "consent_data_sharing_date",
              "createdAt",
              "updatedAt",
              "timeToCompletionSeconds",
              "experienceBnplRating",
              "points",
              "hasCreditCard",
              "consentAdult",
              "consent_data_sharing",
              "consentMarketing",
              "formFullfilled",
              "kycStatus",
              "_id",
              "__v",
              "password",
            ].includes(key)
          ) {
            formattedUser[key] = value?.toString() || "N/A";
          }
        });

        return formattedUser;
      });

      const csvData = createCsv(headers, formattedData);
      fs.writeFileSync(filePath, csvData);
      return { path: filePath, filename };
    } catch (error) {
      throw InternalError("Failed to export waitlist to CSV");
    }
  }
}

export default new WaitlistService();
