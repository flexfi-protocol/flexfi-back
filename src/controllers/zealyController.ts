import { NextFunction, Request, Response } from "express";
import { zealyConfig } from "../config/zealy";
import { UserDocument } from "../models/User";
import zealyService from "../services/zealyService";
import logger from "../utils/logger";
import { checkRateLimit } from "../utils/zealyUtils";

export class ZealyController {
  // Connect user to Zealy by finding their account
  async connect(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req.user as UserDocument)?._id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Check rate limit
      if (!checkRateLimit(userId.toString())) {
        res.status(429).json({ error: "Too many requests, please try again later" });
        return;
      }

      const user = req.user as UserDocument;
      
      // Check identifiers to look up in Zealy
      const identifiers = {
        email: user.email,
        discordHandle: user.discord_handle
      };

      // Try to find user in Zealy
      const updatedUser = await zealyService.findZealyUser(
        userId.toString(),
        identifiers
      );

      // Redirect to frontend with success message
      const redirectUrl = new URL(zealyConfig.frontendRedirectUrl);
      redirectUrl.searchParams.append("status", "success");
      redirectUrl.searchParams.append("zealy_points", updatedUser.flexpoints_zealy.toString());
      redirectUrl.searchParams.append("total_points", updatedUser.flexpoints_total.toString());
      
      res.redirect(redirectUrl.toString());
    } catch (error: any) {
      logger.error("Zealy connect error:", error);
      
      // Determine the appropriate redirect URL with error message
      const redirectUrl = new URL(zealyConfig.frontendRedirectUrl);
      redirectUrl.searchParams.append("status", "error");
      redirectUrl.searchParams.append("message", error.message || "Failed to connect Zealy account");
      
      res.redirect(redirectUrl.toString());
    }
  }

  // Callback handler for Zealy integration
  async callback(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req.user as UserDocument)?._id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Check rate limit
      if (!checkRateLimit(userId.toString())) {
        res.status(429).json({ error: "Too many requests, please try again later" });
        return;
      }

      // Get the account identifiers from the request
      // This could be provided by a form the user filled out
      const { email, discordHandle, discordId, twitterUsername, ethAddress } = req.query;
      
      // Validate at least one identifier is provided
      if (!email && !discordHandle && !discordId && !twitterUsername && !ethAddress) {
        res.status(400).json({ error: "At least one identifier is required" });
        return;
      }

      // Find the user in Zealy
      const updatedUser = await zealyService.findZealyUser(
        userId.toString(),
        {
          email: email as string,
          discordHandle: discordHandle as string,
          discordId: discordId as string,
          twitterUsername: twitterUsername as string,
          ethAddress: ethAddress as string
        }
      );

      // Redirect to frontend with success message
      const redirectUrl = new URL(zealyConfig.frontendRedirectUrl);
      redirectUrl.searchParams.append("status", "success");
      redirectUrl.searchParams.append("zealy_points", updatedUser.flexpoints_zealy.toString());
      redirectUrl.searchParams.append("total_points", updatedUser.flexpoints_total.toString());
      
      res.redirect(redirectUrl.toString());
    } catch (error: any) {
      logger.error("Zealy callback error:", error);
      
      // Redirect to frontend with error message
      const redirectUrl = new URL(zealyConfig.frontendRedirectUrl);
      redirectUrl.searchParams.append("status", "error");
      redirectUrl.searchParams.append("message", error.message || "Failed to connect Zealy account");
      
      res.redirect(redirectUrl.toString());
    }
  }

  // Synchronize Zealy points
  async syncPoints(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req.user as UserDocument)?._id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      // Check rate limit
      if (!checkRateLimit(userId.toString())) {
        res.status(429).json({ error: "Too many requests, please try again later" });
        return;
      }

      const updatedUser = await zealyService.syncUserPoints(userId.toString());
      res.json({
        success: true,
        points: {
          zealy: updatedUser.flexpoints_zealy,
          total: updatedUser.flexpoints_total,
        },
      });
    } catch (error: any) {
      logger.error("Zealy sync points error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to sync Zealy points",
      });
    }
  }

  // Add XP to user's Zealy account
  async addXP(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req.user as UserDocument)?._id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }
      
      const { xp, label, description } = req.body;
      
      if (!xp || !label) {
        res.status(400).json({ error: "XP amount and label are required" });
        return;
      }
      
      const updatedUser = await zealyService.updateUserXP(
        userId.toString(),
        xp,
        label,
        description || "XP added via FlexFi",
        true
      );
      
      res.json({
        success: true,
        points: {
          zealy: updatedUser.flexpoints_zealy,
          total: updatedUser.flexpoints_total,
        },
      });
    } catch (error: any) {
      logger.error("Zealy add XP error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to add Zealy XP",
      });
    }
  }

  // Remove XP from user's Zealy account
  async removeXP(
    req: Request, 
    res: Response, 
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = (req.user as UserDocument)?._id;
      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }
      
      const { xp, label, description } = req.body;
      
      if (!xp || !label) {
        res.status(400).json({ error: "XP amount and label are required" });
        return;
      }
      
      const updatedUser = await zealyService.updateUserXP(
        userId.toString(),
        xp,
        label,
        description || "XP removed via FlexFi",
        false
      );
      
      res.json({
        success: true,
        points: {
          zealy: updatedUser.flexpoints_zealy,
          total: updatedUser.flexpoints_total,
        },
      });
    } catch (error: any) {
      logger.error("Zealy remove XP error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to remove Zealy XP",
      });
    }
  }

  // Quest Management

  // List all quests
  async listQuests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const quests = await zealyService.listQuests();
      res.json({
        success: true,
        data: quests
      });
    } catch (error: any) {
      logger.error("Zealy list quests error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to list Zealy quests",
      });
    }
  }

  // Get a specific quest
  async getQuest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { questId } = req.params;
      
      if (!questId) {
        res.status(400).json({ error: "Quest ID is required" });
        return;
      }
      
      const quest = await zealyService.getQuest(questId);
      res.json({
        success: true,
        data: quest
      });
    } catch (error: any) {
      logger.error("Zealy get quest error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to get Zealy quest",
      });
    }
  }

  // Create a new quest
  async createQuest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const questData = req.body;
      
      // Basic validation - real validation would be more comprehensive
      if (!questData.name || !questData.categoryId) {
        res.status(400).json({ error: "Quest name and category ID are required" });
        return;
      }
      
      const newQuest = await zealyService.createQuest(questData);
      res.status(201).json({
        success: true,
        data: newQuest
      });
    } catch (error: any) {
      logger.error("Zealy create quest error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to create Zealy quest",
      });
    }
  }

  // Update an existing quest
  async updateQuest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { questId } = req.params;
      const questData = req.body;
      
      if (!questId) {
        res.status(400).json({ error: "Quest ID is required" });
        return;
      }
      
      const updatedQuest = await zealyService.updateQuest(questId, questData);
      res.json({
        success: true,
        data: updatedQuest
      });
    } catch (error: any) {
      logger.error("Zealy update quest error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to update Zealy quest",
      });
    }
  }

  // Webhook Management

  // List all webhooks
  async listWebhooks(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const webhooks = await zealyService.listWebhooks();
      res.json({
        success: true,
        data: webhooks
      });
    } catch (error: any) {
      logger.error("Zealy list webhooks error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to list Zealy webhooks",
      });
    }
  }

  // Create a webhook
  async createWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { name, uri, active, events } = req.body;
      
      // Validate required fields
      if (!name || !uri || !events || !Array.isArray(events) || events.length === 0) {
        res.status(400).json({ 
          error: "Webhook name, URI, and at least one event are required" 
        });
        return;
      }
      
      const newWebhook = await zealyService.createWebhook({
        name,
        uri,
        active: active !== false, // Default to true if not specified
        events
      });
      
      res.status(201).json({
        success: true,
        data: newWebhook
      });
    } catch (error: any) {
      logger.error("Zealy create webhook error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to create Zealy webhook",
      });
    }
  }

  // Update a webhook
  async updateWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { webhookId } = req.params;
      const webhookData = req.body;
      
      if (!webhookId) {
        res.status(400).json({ error: "Webhook ID is required" });
        return;
      }
      
      await zealyService.updateWebhook(webhookId, webhookData);
      res.json({
        success: true
      });
    } catch (error: any) {
      logger.error("Zealy update webhook error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to update Zealy webhook",
      });
    }
  }

  // Delete a webhook
  async deleteWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { webhookId } = req.params;
      
      if (!webhookId) {
        res.status(400).json({ error: "Webhook ID is required" });
        return;
      }
      
      await zealyService.deleteWebhook(webhookId);
      res.json({
        success: true
      });
    } catch (error: any) {
      logger.error("Zealy delete webhook error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to delete Zealy webhook",
      });
    }
  }

  // Get webhook event types
  async getWebhookEventTypes(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const eventTypes = await zealyService.getWebhookEventTypes();
      res.json({
        success: true,
        data: eventTypes
      });
    } catch (error: any) {
      logger.error("Zealy get webhook event types error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to get Zealy webhook event types",
      });
    }
  }

  // Get webhook events
  async getWebhookEvents(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { webhookId } = req.params;
      const { limit, page, statusFilter } = req.query;
      
      if (!webhookId) {
        res.status(400).json({ error: "Webhook ID is required" });
        return;
      }
      
      const params: any = {};
      
      if (limit) params.limit = parseInt(limit as string);
      if (page) params.page = parseInt(page as string);
      if (statusFilter) {
        params.statusFilter = Array.isArray(statusFilter) 
          ? statusFilter 
          : [statusFilter as string];
      }
      
      const events = await zealyService.getWebhookEvents(webhookId, params);
      res.json({
        success: true,
        data: events
      });
    } catch (error: any) {
      logger.error("Zealy get webhook events error:", error);
      res.status(error.response?.status || 500).json({
        error: error.response?.data?.message || "Failed to get Zealy webhook events",
      });
    }
  }
}

export default new ZealyController();
