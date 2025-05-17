
import rateLimit from "express-rate-limit";
import logger from "../utils/logger";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limite à 5 requêtes par IP
  message: "Trop de tentatives. Réessayez dans 15 minutes.",
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ 
      success: false, 
      message: "Too many requests. Please try again later."
    });
  }
});
