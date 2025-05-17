import logger from "../utils/logger";
import { Request, Response, NextFunction } from "express";

export const logFailedLogin = (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;
  logger.warn(`Failed login attempt for email: ${email} from IP: ${req.ip}`);
  next();
};
