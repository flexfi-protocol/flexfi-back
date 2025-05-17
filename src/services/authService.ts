import axios from "axios";
import { zealyConfig } from "../config/zealy";
import { User, UserDocument } from "../models/User";
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "../utils/AppError";
import { generateToken } from "../utils/jwt";
import logger from "../utils/logger";
import brevoService from "./brevoService";

export class AuthService {
  // Inscription avec email/mot de passe
  async registerWithEmail(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    referralCodeUsed?: string,
    isVerified?: boolean,
    deviceType?: string,
    browser?: string,
    ipCity?: string,
    deviceLocale?: string
  ): Promise<{ user: UserDocument; token: string; verificationCode: string }> {
    try {
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw ConflictError("User already exists");
      }

      // Créer un referral code
      const referralCode = await this.generateUniqueReferralCode();
      const verificationCode = await this.generateVerificationCode();
      // Créer un nouvel utilisateur
      const user = new User({
        email: email.toLowerCase(),
        password: password,
        firstName: firstName?.toLowerCase(),
        lastName: lastName?.toLowerCase(),
        isVerified: isVerified,
        authMethod: "email",
        referralCodeUsed: referralCodeUsed?.toUpperCase(),
        userReferralCode: referralCode.toUpperCase(),
        verificationCode: verificationCode,
        deviceType: deviceType,
        browser: browser,
        ipCity: ipCity,
        deviceLocale: deviceLocale,
      });

      await user.save();

      // Générer un JWT
      const token = generateToken(user);

      // Vérifier et appliquer les points de parrainage
      if (referralCodeUsed) {
        const referrer = await User.findOne({
          userReferralCode: referralCodeUsed.toUpperCase(),
        });
        if (referrer) {
          await referrer.addNativePoints(5);
        }
      }

      return { user, token, verificationCode };
    } catch (error: any) {
      // Propager l'erreur AppError
      if (error instanceof AppError) throw error;
      // Sinon envelopper dans InternalError
      throw InternalError(`Registration failed: ${error.message}`);
    }
  }

  // Connexion avec email/mot de passe
  async loginWithEmail(
    email: string,
    password: string
  ): Promise<{ user: UserDocument; token: string }> {
    try {
      // Trouver l'utilisateur
      const user = await User.findOne({ email });
      if (!user) {
        throw UnauthorizedError("Invalid credentials");
      }

      // Vérifier le mot de passe
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw UnauthorizedError("Invalid credentials");
      }

      // Générer un JWT
      const token = generateToken(user);

      return { user, token };
    } catch (error: any) {
      // Propager l'erreur AppError
      if (error instanceof AppError) throw error;
      // Sinon envelopper dans InternalError
      throw InternalError(`Login failed: ${error.message}`);
    }
  }

  // Trouver ou créer un utilisateur via OAuth (Google, Apple, Twitter)
  async findOrCreateOAuthUser(
    profile: any,
    authMethod: "google" | "apple" | "twitter"
  ): Promise<{ user: UserDocument; token: string }> {
    try {
      let user: UserDocument | null = null;

      // Déterminer l'ID basé sur la méthode d'auth
      let query: any = { email: profile.email };

      // Trouver l'utilisateur existant
      user = await User.findOne(query);

      if (!user) {
        const verificationCode = await this.generateVerificationCode();
        // Créer un nouvel utilisateur
        user = new User({
          email: profile.email,
          firstName:
            profile.firstName || profile.given_name || profile.name?.givenName,
          lastName:
            profile.lastName || profile.family_name || profile.name?.familyName,
          authMethod,
          verificationCode: verificationCode,
        });

        // Ajouter l'ID spécifique au provider
        if (authMethod === "google") user.googleId = profile.id;
        else if (authMethod === "apple") user.appleId = profile.id;
        else if (authMethod === "twitter") user.twitterId = profile.id;

        await user.save();
      } else {
        // Mettre à jour l'ID si l'utilisateur existe mais n'a pas encore cet ID
        if (authMethod === "google" && !user.googleId) {
          user.googleId = profile.id;
          await user.save();
        } else if (authMethod === "apple" && !user.appleId) {
          user.appleId = profile.id;
          await user.save();
        } else if (authMethod === "twitter" && !user.twitterId) {
          user.twitterId = profile.id;
          await user.save();
        }
      }

      // Générer un JWT
      const token = generateToken(user);

      return { user: user as UserDocument, token };
    } catch (error: any) {
      // Propager l'erreur AppError
      if (error instanceof AppError) throw error;
      // Sinon envelopper dans InternalError
      throw InternalError(`OAuth authentication failed: ${error.message}`);
    }
  }

  private generateReferralCode(): string {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return `FLEX-${code}`;
  }

  private async generateUniqueReferralCode(): Promise<string> {
    let code = this.generateReferralCode();
    let exists = await User.findOne({ userReferralCode: code });
    while (exists) {
      code = this.generateReferralCode();
      exists = await User.findOne({ userReferralCode: code });
    }
    return code;
  }

  async getTopReferrals(): Promise<UserDocument[]> {
    try {
      const topReferrals = await User.find()
        .select("email firstName lastName flexpoints_total userReferralCode")
        .sort({ flexpoints_total: -1 })
        .limit(10);

      if (!topReferrals || topReferrals.length === 0) {
        throw NotFoundError("No referrals found");
      }

      return topReferrals;
    } catch (error: any) {
      // Propager l'erreur AppError
      if (error instanceof AppError) throw error;
      // Sinon envelopper dans InternalError
      throw InternalError(`Failed to get top referrals: ${error.message}`);
    }
  }

  // Récupérer un utilisateur par son ID
  async getUserById(userId: string): Promise<UserDocument> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw NotFoundError("User not found");
      }
      return user;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw InternalError(`Failed to get user: ${error.message}`);
    }
  }

  // Récupérer les points d'un utilisateur
  async getUserPoints(userId: string): Promise<number> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw NotFoundError("User not found");
      }

      // Si l'utilisateur a un compte Zealy, synchroniser les points
      if (user.zealy_id) {
        try {
          const response = await axios.get(
            `${zealyConfig.apiUrl}/communities/${zealyConfig.communityId}/users/${user.zealy_id}`,
            {
              headers: {
                Authorization: `Bearer ${zealyConfig.apiKey}`,
              },
            }
          );

          const { points } = response.data;

          // Mettre à jour les points Zealy en utilisant la méthode du modèle
          const updatedUser = await user.addZealyPoints(points);
          return updatedUser.flexpoints_total || 0;
        } catch (error) {
          logger.error("Failed to sync Zealy points:", error);
          // En cas d'erreur de synchronisation, on continue avec les points actuels
        }
      }

      // Récupérer l'utilisateur mis à jour
      const updatedUser = await User.findById(userId);
      return updatedUser?.flexpoints_total || 0;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw InternalError(`Failed to get user points: ${error.message}`);
    }
  }

  // Récupérer le rang d'un utilisateur
  async getUserRank(userId: string): Promise<number> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw NotFoundError("User not found");
      }

      // Compter le nombre d'utilisateurs avec plus de points
      const rank = await User.countDocuments({
        flexpoints_total: { $gt: user.flexpoints_total || 0 },
      });
      return rank + 1; // +1 car le rang commence à 1
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw InternalError(`Failed to get user rank: ${error.message}`);
    }
  }

  async verifyVerificationCode(id: string, code: string): Promise<void> {
    const user = await User.findOne({ _id: id });
    if (!user) {
      throw new Error("User not found");
    }
    console.log(
      "Stored code:",
      user.verificationCode,
      typeof user.verificationCode
    );
    console.log("Verifying user with ID:", id, "and code:", code);
    if (String(user.verificationCode) !== String(code)) {
      throw new Error("Invalid verification code");
    }

    console.log("PASSED COMPARISON, user verified");

    user.isVerified = true;
    user.verificationCode = "";
    await user.save();

    // Ajouter les points de vérification
    await user.addNativePoints(100);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw NotFoundError("User not found");
    }

    if (user.isVerified) {
      throw ConflictError("User is already verified");
    }

    const newCode = await this.generateVerificationCode();
    user.verificationCode = newCode;
    await user.save();

    await brevoService.sendVerificationEmail(user.email);
  }

  async verifyResetPasswordAndToken(
    resetToken: string,
    password: string
  ): Promise<void> {
    const user = await User.findOne({ resetToken: resetToken });
    if (!user) {
      throw new Error("Invalid reset token");
    }
    user.password = password;
    user.resetToken = "";
    await user.save();
  }

  async generateVerificationCode(): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    return code;
  }
}

export default new AuthService();
