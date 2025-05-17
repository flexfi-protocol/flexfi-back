import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

const JWT_SECRET = process.env.JWT_SECRET || "";

const revokedTokens: Set<string> = new Set();

export const checkToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  if (revokedTokens.has(token)) {
    logger.warn(`Attempt to use a revoked token: ${token}`);
    return res.status(401).json({ message: "Token has been revoked" });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    logger.error(`Invalid token: ${token}`);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Fonction pour revoquer un token quand on se deco par exemple (test)
export const revokeToken = (token: string) => {
  revokedTokens.add(token);
};
