import { Router } from "express";
import waitlistController from "../controllers/waitlistController";
import { adminOnly } from "../middlewares/authMiddleware";
import { validate } from "../middlewares/validationMiddleware";
import { registerWaitlistUserValidation } from "../validations/waitlistValidations";

const router = Router();

// Register a user in the waitlist
router.post(
  "/",
  validate(registerWaitlistUserValidation),
  waitlistController.registerFormUser
);

// Get total number of users in the waitlist
router.get("/count", waitlistController.getWaitlistCount);

// Get referrals count for a specific code
router.get("/referral/:code", waitlistController.getReferralCount);

// Export waitlist users (admin only)
router.get("/export", adminOnly, (req, res, next) =>
  waitlistController.exportWaitlist(req, res, next)
);

export default router;
