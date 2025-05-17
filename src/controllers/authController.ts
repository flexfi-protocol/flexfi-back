import { NextFunction, Request, Response } from "express";
import { UserDocument } from "../models/User";
import authService from "../services/authService";
import notificationService from "../services/notificationService";
import { AppError } from "../utils/AppError";
import logger from "../utils/logger";
import { validateEmail, validatePassword } from "../utils/validators";

// Helper function to send Zealy connection email after successful registration
const sendZealyConnectionEmail = async (userId: string): Promise<void> => {
  try {
    // Wait a bit to ensure the user is fully registered
    setTimeout(async () => {
      try {
        await notificationService.sendZealyConnectionEmail(userId);
      } catch (error) {
        logger.error(
          `Failed to send Zealy connection email to user ${userId}:`,
          error
        );
        // Don't throw error here, as this is a background task
      }
    }, 5000);
  } catch (error) {
    logger.error(
      `Error scheduling Zealy connection email for user ${userId}:`,
      error
    );
  }
};

export class AuthController {
  // Inscription avec email/mot de passe
  async register(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email, firstName, lastName, password, referralCodeUsed } =
        req.body;

      // Validate email and password
      if (!validateEmail(email)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }

      if (!validatePassword(password)) {
        res.status(400).json({
          error:
            "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character",
        });
        return;
      }

      const isVerified = false;
      const deviceType =
        req.headers["sec-ch-ua-platform"]?.toString() || undefined;
      const browser = req.headers["user-agent"]?.toString() || undefined;
      const ipCity =
        req.headers["x-forwarded-for"]?.toString() ||
        req.socket.remoteAddress?.toString() ||
        undefined;
      const deviceLocale =
        req.headers["accept-language"]?.toString() || undefined;

      const { user, token }: { user: UserDocument; token: string } =
        await authService.registerWithEmail(
          email,
          password,
          firstName,
          lastName,
          referralCodeUsed,
          isVerified,
          deviceType,
          browser,
          ipCity,
          deviceLocale
        );

      // Schedule sending the Zealy connection email
      if (user && user._id) {
        await sendZealyConnectionEmail(user._id.toString());
      }

      // Return success response
      res.status(201).json({
        success: true,
        data: {
          user: {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            isVerified: user.isVerified,
            userReferralCode: user.userReferralCode,
            formFullfilled: user.formFullfilled,
          },
          token: token,
        },
        message:
          "Registration successful. Please check your email for verification.",
      });
    } catch (error: any) {
      logger.error("Registration error:", error);
      if (
        error &&
        error.message &&
        error.message.includes("User already exists")
      ) {
        res.status(409).json({ error: error.message });
        return;
      }
      next(new AppError(error.message, 400));
    }
  }

  async activateAccountViaLink(req: Request, res: Response): Promise<void> {
    try {
      // Récupération sécurisée des paramètres de query
      const id = req.query.id?.toString();
      const token = req.query.token?.toString();

      // Vérification des paramètres
      if (!id || !token) {
        res.status(400).json({ error: "Missing id or token" });
        return;
      }

      // Appel du service pour vérification
      await authService.verifyVerificationCode(id, token);

      // Succès
      res.status(200).json({ message: "Account activated successfully" });
    } catch (error) {
      console.error("Activation error:", error);
      res.status(400).json({ error: "Invalid or expired activation link" });
    }
  }

  async resendVerificationEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email is required" });
        return;
      }

      await authService.resendVerificationEmail(email);
      res
        .status(200)
        .json({ message: "Verification email resent successfully" });
    } catch (error) {
      res.status(400).json({
        error:
          (error as Error).message || "Failed to resend verification email",
      });
    }
  }

  // Connexion avec email/mot de passe
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          status: "error",
          message: "Email and password are required",
        });
        return;
      }

      const { user, token } = await authService.loginWithEmail(email, password);

      // Ne pas renvoyer le mot de passe dans la réponse
      const userResponse = {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        authMethod: user.authMethod,
        wallets: user.wallets,
        kycStatus: user.kycStatus,
        selectedCard: user.selectedCard,
        formFullfilled: user.formFullfilled,
        userReferralCode: user.userReferralCode,
        isVerified: user.isVerified,
      };

      // Logger la connexion réussie
      logger.info(`User logged in: ${user._id}`, { userId: user._id });

      res.status(200).json({
        status: "success",
        data: { user: userResponse, token },
      });
    } catch (error) {
      // Passer l'erreur au middleware de gestion d'erreurs global
      next(error);
    }
  }

  // Callback pour Google OAuth
  async googleCallback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Passport.js aura déjà authentifié l'utilisateur et mis le profil dans req.user
      const profile = req.user as any;

      if (!profile) {
        res
          .status(401)
          .json({ status: "error", message: "Google authentication failed" });
        return;
      }

      const { user, token } = await authService.findOrCreateOAuthUser(
        profile,
        "google"
      );

      // Logger la connexion OAuth réussie
      logger.info(`User authenticated via Google: ${user._id}`, {
        userId: user._id,
      });

      // En production, redirigez vers le frontend avec le token
      // res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);

      // Pour cet exemple, nous renvoyons simplement le token
      res.status(200).json({
        status: "success",
        data: { user, token },
      });
    } catch (error) {
      // Passer l'erreur au middleware de gestion d'erreurs global
      next(error);
    }
  }

  // Callback pour Apple Sign In
  async appleCallback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Passport.js aura déjà authentifié l'utilisateur et mis le profil dans req.user
      const profile = req.user as any;

      if (!profile) {
        res
          .status(401)
          .json({ status: "error", message: "Apple authentication failed" });
        return;
      }

      const { user, token } = await authService.findOrCreateOAuthUser(
        profile,
        "apple"
      );

      // Logger la connexion OAuth réussie
      logger.info(`User authenticated via Apple: ${user._id}`, {
        userId: user._id,
      });

      // En production, redirigez vers le frontend avec le token
      // res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);

      // Pour cet exemple, nous renvoyons simplement le token
      res.status(200).json({
        status: "success",
        data: { user, token },
      });
    } catch (error) {
      // Passer l'erreur au middleware de gestion d'erreurs global
      next(error);
    }
  }

  // Callback pour Twitter OAuth
  async twitterCallback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Passport.js aura déjà authentifié l'utilisateur et mis le profil dans req.user
      const profile = req.user as any;

      if (!profile) {
        res
          .status(401)
          .json({ status: "error", message: "Twitter authentication failed" });
        return;
      }

      const { user, token } = await authService.findOrCreateOAuthUser(
        profile,
        "twitter"
      );

      // Logger la connexion OAuth réussie
      logger.info(`User authenticated via Twitter: ${user._id}`, {
        userId: user._id,
      });

      // En production, redirigez vers le frontend avec le token
      // res.redirect(`${process.env.FRONTEND_URL}?token=${token}`);

      // Pour cet exemple, nous renvoyons simplement le token
      res.status(200).json({
        status: "success",
        data: { user, token },
      });
    } catch (error) {
      // Passer l'erreur au middleware de gestion d'erreurs global
      next(error);
    }
  }

  // Récupérer l'utilisateur actuel
  async getCurrentUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req.user as any)?._id;
      if (!userId) {
        res.status(401).json({
          status: "error",
          message: "Not authenticated",
        });
        return;
      }

      const user = await authService.getUserById(userId.toString());
      if (!user) {
        res.status(404).json({
          status: "error",
          message: "User not found",
        });
        return;
      }

      res.status(200).json({
        status: "success",
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  // Récupérer le top 10 des parrainages
  async getTopReferrals(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const topReferrals = await authService.getTopReferrals();

      // Formater la réponse pour ne pas exposer les données sensibles
      const formattedReferrals = topReferrals.map((user) => ({
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        flexpoints_total: user.flexpoints_total,
        userReferralCode: user.userReferralCode,
      }));

      res.status(200).json({
        status: "success",
        data: {
          topReferrals: formattedReferrals,
          count: formattedReferrals.length,
        },
      });
    } catch (error: any) {
      // Logger l'erreur
      logger.error(`Error getting top referrals: ${error.message}`, {
        error: error.stack,
      });
      next(error);
    }
  }

  // Récupérer les points de l'utilisateur
  async getUserPoints(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req.user as UserDocument)?._id;
      if (!userId) {
        res.status(401).json({
          status: "error",
          message: "Not authenticated",
        });
        return;
      }

      const points = await authService.getUserPoints(userId.toString());
      res.status(200).json({
        status: "success",
        data: { points },
      });
    } catch (error) {
      next(error);
    }
  }

  // Récupérer le rang de l'utilisateur
  async getUserRank(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req.user as any)?._id;
      if (!userId) {
        res.status(401).json({
          status: "error",
          message: "Not authenticated",
        });
        return;
      }

      const rank = await authService.getUserRank(userId.toString());
      res.status(200).json({
        status: "success",
        data: { rank },
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyVerificationCode(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { code } = req.body;
      if (!id || !code) {
        res.status(400).json({ error: "Missing id or code" });
        return;
      }
      await authService.verifyVerificationCode(id, code);
      res.status(200).json({ message: "Code verified successfully" });
    } catch (error) {
      res.status(400).json({ error: "Invalid verification code" });
    }
  }

  async verifyResetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body;
      await authService.verifyResetPasswordAndToken(token, password);
      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      res.status(400).json({ error: "Invalid reset token or password" });
    }
  }
}

export default new AuthController();
