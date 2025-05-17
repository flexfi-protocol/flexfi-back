import { NextFunction, Request, Response } from "express";
import fs from "fs";
import { IWaitlistFormData, IWaitlistUser, UserDocument } from "../models/User";
import waitlistService from "../services/waitlistService";

export class WaitlistController {
  // Register a new user in the waitlist
  async registerFormUser(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const formData: IWaitlistFormData = req.body;

      const { email, ...formDataWithoutEmail } = formData;

      const userData: IWaitlistUser = {
        email,
        formData: formDataWithoutEmail,
      };

      const updatedUser: UserDocument = await waitlistService.registerFormInfos(
        userData
      );

      const userResponse = {
        _id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        authMethod: updatedUser.authMethod,
        userReferralCode: updatedUser.userReferralCode,
        wallets: updatedUser.wallets,
        kycStatus: updatedUser.kycStatus,
        formFullfilled: updatedUser.formFullfilled,
        flexpoints_total: updatedUser.flexpoints_total,
      };

      res.status(201).json({
        status: "success",
        data: userResponse,
      });
    } catch (error: any) {
      next(error);
    }
  }

  // Get total number of users in the waitlist
  async getWaitlistCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const count = await waitlistService.getWaitlistCount();

      res.status(200).json({
        status: "success",
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get number of referrals linked to a code
  async getReferralCount(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { code } = req.params;
      const referrals = await waitlistService.getReferralCount(code);

      res.status(200).json({
        status: "success",
        data: { code, referrals },
      });
    } catch (error) {
      next(error);
    }
  }

  // Export waitlist users to CSV
  async exportWaitlist(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    let csvFilePath: string | null = null;
    try {
      const { path, filename } = await waitlistService.exportWaitlistToCSV();
      csvFilePath = path;

      res.download(path, filename, (err) => {
        if (err) {
          if (!res.headersSent) {
            res.status(500).json({
              status: "error",
              message: "Failed to download the file",
            });
          }
        }
      });
    } catch (error) {
      // Clean up file in case of error
      if (csvFilePath && fs.existsSync(csvFilePath)) {
        fs.unlinkSync(csvFilePath);
      }
      next(error);
    }
  }
}

export default new WaitlistController();
