import * as SibApiV3Sdk from "@sendinblue/client";

import env from "../config/env";
import { User, UserDocument } from "../models/User";
import authService from "./authService";
import logger from "../utils/logger";

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
apiInstance.setApiKey(
  SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey,
  env.BREVO_API_KEY
);

export class BrevoService {
  async sendVerificationEmail(email: string): Promise<void> {
    try {
      const userToVerify = await User.findOne({ email: email.toLowerCase() });
      if (!userToVerify) {
        throw new Error("User not found");
      }
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.to = [
        {
          email: userToVerify.email,
          name:
            [userToVerify.firstName, userToVerify.lastName]
              .filter(Boolean)
              .join(" ") || userToVerify.email,
        },
      ];
      sendSmtpEmail.templateId = parseInt(env.BREVO_TEMPLATE_SIGNUP_ID);
      sendSmtpEmail.params = {
        username: userToVerify.firstName,
        activation_link: `http://localhost:5173/activate?token=${userToVerify.verificationCode}&id=${userToVerify._id}`,
      };

      await apiInstance.sendTransacEmail(sendSmtpEmail);
    } catch (error) {
      throw new Error(`Failed to send verification email: ${error}`);
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        throw new Error("User not found");
      }
      const resetToken = await this.generateResetToken(user);
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.to = [{ email: user.email }];
      sendSmtpEmail.templateId = parseInt(env.BREVO_TEMPLATE_RESET_PASSWORD_ID);
      sendSmtpEmail.params = {
        username: user.firstName,
        reset_link: `https://www.flex-fi.io/reset-password?token=${resetToken}`,
      };

      await apiInstance.sendTransacEmail(sendSmtpEmail);
    } catch (error) {
      throw new Error(`Failed to send password reset email: ${error}`);
    }
  }

  async generateResetToken(user: UserDocument): Promise<string> {
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetToken = resetToken;
    await user.save();
    return resetToken;
  }

  /**
   * Send a template email using Brevo API
   * @param to Recipient email address
   * @param subject Email subject
   * @param templateName Template name (must be configured in Brevo)
   * @param templateData Data to be used in the template
   */
  async sendTemplateEmail(
    to: string,
    subject: string,
    templateName: string,
    templateData: Record<string, any>
  ): Promise<void> {
    try {
      // Map template name to template ID
      const templateIdMap: Record<string, number> = {
        signup: parseInt(env.BREVO_TEMPLATE_SIGNUP_ID),
        "reset-password": parseInt(env.BREVO_TEMPLATE_RESET_PASSWORD_ID),
        "zealy-connection": parseInt(env.BREVO_TEMPLATE_ZEALY_ID || "0"),
      };

      const templateId = templateIdMap[templateName];
      if (!templateId) {
        throw new Error(`Unknown email template: ${templateName}`);
      }

      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
      sendSmtpEmail.to = [{ email: to }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.templateId = templateId;
      sendSmtpEmail.params = templateData;

      await apiInstance.sendTransacEmail(sendSmtpEmail);
      logger.info(`Template email '${templateName}' sent to ${to}`);
    } catch (error) {
      logger.error(`Failed to send template email:`, error);
      throw new Error(`Failed to send template email: ${error}`);
    }
  }
}

export default new BrevoService();
