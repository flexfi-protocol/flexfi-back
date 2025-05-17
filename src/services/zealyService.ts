import axios from "axios";
import { zealyConfig } from "../config/zealy";
import { User, UserDocument } from "../models/User";
import { InternalError, NotFoundError } from "../utils/AppError";
import logger from "../utils/logger";

export class ZealyService {
  // Find a user in Zealy by various identifiers (email, discord, wallet, etc.)
  async findZealyUser(
    userId: string,
    identifiers: { 
      discordId?: string;
      discordHandle?: string;
      twitterUsername?: string;
      email?: string;
      ethAddress?: string;
    }
  ): Promise<UserDocument> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw NotFoundError("User not found");
      }

      // Construct query parameters
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(identifiers)) {
        if (value) params[key] = value;
      }

      if (Object.keys(params).length === 0) {
        throw InternalError("At least one identifier must be provided");
      }

      // Search for user in Zealy
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users`,
        {
          params,
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );

      const zealyUserData = response.data;
      
      // Update user in our database
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            zealy_id: zealyUserData.id,
            discord_handle: zealyUserData.discordHandle || user.discord_handle,
          },
        },
        { new: true }
      );

      if (!updatedUser) {
        throw NotFoundError("Failed to update user");
      }

      // Update points
      return await updatedUser.setZealyPoints(zealyUserData.xp || 0);
    } catch (error: any) {
      logger.error("Zealy findUser error:", error);
      if (error.response?.status === 404) {
        throw NotFoundError("User not found in Zealy community");
      }
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to find Zealy user: ${error.message}`);
    }
  }

  // Synchronize Zealy points for a user
  async syncUserPoints(userId: string): Promise<UserDocument> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw NotFoundError("User not found");
      }

      if (!user.zealy_id) {
        throw NotFoundError("User has no Zealy account connected");
      }

      // Get Zealy user data with points
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users/${user.zealy_id}`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );

      // Update points using the model method
      return await user.setZealyPoints(response.data.xp || 0);
    } catch (error: any) {
      logger.error("Zealy sync points error:", error);
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to sync Zealy points: ${error.message}`);
    }
  }

  // Add or remove XP points for a user in Zealy
  async updateUserXP(
    userId: string, 
    points: number,
    label: string,
    description: string,
    isAdd: boolean = true
  ): Promise<UserDocument> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw NotFoundError("User not found");
      }

      if (!user.zealy_id) {
        throw NotFoundError("User has no Zealy account connected");
      }

      // Add or remove XP in Zealy
      const method = isAdd ? 'post' : 'delete';
      const response = await axios({
        method,
        url: `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users/${user.zealy_id}/xp`,
        headers: {
          "x-api-key": zealyConfig.apiKey,
        },
        data: {
          xp: Math.abs(points),
          label,
          description
        }
      });

      // Sync the user to get updated points
      return await this.syncUserPoints(userId);
    } catch (error: any) {
      logger.error(`Zealy ${isAdd ? 'add' : 'remove'} XP error:`, error);
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to ${isAdd ? 'add' : 'remove'} Zealy XP: ${error.message}`);
    }
  }

  // Quest Management

  // Get all quests in the community
  async listQuests(): Promise<any[]> {
    try {
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/quests`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy list quests error:", error);
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to list Zealy quests: ${error.message}`);
    }
  }

  // Get a specific quest by ID
  async getQuest(questId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/quests/${questId}`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy get quest error:", error);
      if (error.response?.status === 404) {
        throw NotFoundError("Quest not found");
      }
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to get Zealy quest: ${error.message}`);
    }
  }

  // Create a new quest
  async createQuest(questData: any): Promise<any> {
    try {
      const response = await axios.post(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/quests`,
        questData,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
            "Content-Type": "application/json"
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy create quest error:", error);
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to create Zealy quest: ${error.message}`);
    }
  }

  // Update an existing quest
  async updateQuest(questId: string, questData: any): Promise<any> {
    try {
      const response = await axios.patch(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/quests/${questId}`,
        questData,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
            "Content-Type": "application/json"
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy update quest error:", error);
      if (error.response?.status === 404) {
        throw NotFoundError("Quest not found");
      }
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to update Zealy quest: ${error.message}`);
    }
  }

  // Webhook Management

  // Get all webhooks
  async listWebhooks(): Promise<any> {
    try {
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/webhooks`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy list webhooks error:", error);
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to list Zealy webhooks: ${error.message}`);
    }
  }

  // Create a new webhook
  async createWebhook(webhookData: {
    name: string;
    uri: string;
    active: boolean;
    events: string[];
  }): Promise<any> {
    try {
      const response = await axios.post(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/webhooks`,
        webhookData,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
            "Content-Type": "application/json"
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy create webhook error:", error);
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to create Zealy webhook: ${error.message}`);
    }
  }

  // Update a webhook
  async updateWebhook(webhookId: string, webhookData: {
    name?: string;
    uri?: string;
    active?: boolean;
    events?: string[];
  }): Promise<void> {
    try {
      await axios.patch(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/webhooks/${webhookId}`,
        webhookData,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
            "Content-Type": "application/json"
          },
        }
      );
    } catch (error: any) {
      logger.error("Zealy update webhook error:", error);
      if (error.response?.status === 404) {
        throw NotFoundError("Webhook not found");
      }
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to update Zealy webhook: ${error.message}`);
    }
  }

  // Delete a webhook
  async deleteWebhook(webhookId: string): Promise<void> {
    try {
      await axios.delete(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/webhooks/${webhookId}`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );
    } catch (error: any) {
      logger.error("Zealy delete webhook error:", error);
      if (error.response?.status === 404) {
        throw NotFoundError("Webhook not found");
      }
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to delete Zealy webhook: ${error.message}`);
    }
  }

  // Get webhook event types
  async getWebhookEventTypes(): Promise<string[]> {
    try {
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/webhooks-event-types`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy get webhook event types error:", error);
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to get Zealy webhook event types: ${error.message}`);
    }
  }

  // Get webhook events
  async getWebhookEvents(webhookId: string, params?: {
    limit?: number;
    page?: number;
    statusFilter?: string[];
  }): Promise<any> {
    try {
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/webhooks/${webhookId}/events`,
        {
          params,
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      logger.error("Zealy get webhook events error:", error);
      if (error.response?.status === 404) {
        throw NotFoundError("Webhook not found");
      }
      if (error instanceof Error) throw error;
      throw InternalError(`Failed to get Zealy webhook events: ${error.message}`);
    }
  }
}

export default new ZealyService();
