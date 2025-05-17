import { Router } from "express";
import passport from "passport";
import authController from "../controllers/authController";
import brevoController from "../controllers/brevoController";
import { authenticate } from "../middlewares/authMiddleware";
import { resetPasswordValidation } from "../validations/resetPaswordValidation";
import { registerUserValidation } from "../validations/userValidation";

const router = Router();

// Routes pour l'authentification par email
router.post("/register", registerUserValidation, authController.register);
router.post("/login", authController.login);

// Routes pour l'authentification par OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  authController.googleCallback
);

router.get("/apple", passport.authenticate("apple"));
router.get(
  "/apple/callback",
  passport.authenticate("apple", { session: false }),
  authController.appleCallback
);

router.get("/twitter", passport.authenticate("twitter"));
router.get(
  "/twitter/callback",
  passport.authenticate("twitter", { session: false }),
  authController.twitterCallback
);

// Route pour récupérer l'utilisateur actuel
router.get("/me", authenticate, authController.getCurrentUser);

// Route pour récupérer le top 10 des parrainages
router.get("/top-referrals", authController.getTopReferrals);

// Routes pour récupérer les points et le rang de l'utilisateur
router.get("/points", authenticate, authController.getUserPoints);
router.get("/rank", authenticate, authController.getUserRank);

// Route pour demander d'envoyer le code de vérification
router.post("/send-code", brevoController.sendVerificationCode);

// Route pour vérifier le code de vérification
router.post("/activate/:id", authController.verifyVerificationCode);

router.post("/resend-verification", authController.resendVerificationEmail);

router.get("/activate", authController.activateAccountViaLink);

// Route pour réinitialiser le mot de passe
router.post("/reset-password", brevoController.sendPasswordReset);
// Route pour vérifier le token et le mot de passe lors de la réini
router.post(
  "/verify-reset-password",
  resetPasswordValidation,
  authController.verifyResetPassword
);

export default router;
