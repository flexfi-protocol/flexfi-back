import axios from "axios";
import { zealyConfig } from "../config/zealy";
import { User } from "../models/User";
import logger from "../utils/logger";
import mongoose from "mongoose";
import env from "../config/env";

// This script tests the entire user connection flow without requiring HTTP requests
// It uses direct API calls to simulate what would happen in the controller

async function connectToMongoDB() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

async function testUserConnection(userEmail: string, discordHandle?: string) {
  logger.info(`Testing Zealy user connection for ${userEmail}`);

  try {
    // 1. Find user in our database
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      logger.error(`❌ User with email ${userEmail} not found in our database`);
      return;
    }
    logger.info(`✅ Found local user: ${user._id}`);

    // 2. Prepare identifiers for search
    const identifiers: Record<string, string> = {
      email: userEmail
    };

    if (discordHandle) {
      identifiers.discordHandle = discordHandle;
    } else if (user.discord_handle) {
      identifiers.discordHandle = user.discord_handle;
    }

    logger.info(`Searching for Zealy user with identifiers: ${JSON.stringify(identifiers)}`);

    // 3. Search for user in Zealy
    try {
      const response = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users`,
        {
          params: identifiers,
          headers: {
            "x-api-key": zealyConfig.apiKey,
          },
        }
      );

      logger.info(`✅ Found user in Zealy community: ${response.data.id}`);
      logger.info(`Zealy username: ${response.data.name}`);
      logger.info(`Zealy XP: ${response.data.xp}`);

      // 4. Update user in our database (simulate)
      logger.info("Would update local user with:");
      logger.info(`- Zealy ID: ${response.data.id}`);
      logger.info(`- Discord handle: ${response.data.discordHandle || user.discord_handle}`);
      logger.info(`- XP points: ${response.data.xp}`);

      // 5. Test getting user details directly
      if (response.data.id) {
        const userDetailResponse = await axios.get(
          `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users/${response.data.id}`,
          {
            headers: {
              "x-api-key": zealyConfig.apiKey,
            },
          }
        );
        logger.info(`✅ Successfully retrieved detailed user info`);
        logger.info(`User details: ${JSON.stringify(userDetailResponse.data, null, 2)}`);
      }

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn(`⚠️ User not found in Zealy community`);
        logger.info("This means the user needs to join the community first");
      } else {
        logger.error(`❌ Error searching for user in Zealy: ${error.message}`);
        if (error.response) {
          logger.error(`Status: ${error.response.status}`);
          logger.error(`Data: ${JSON.stringify(error.response.data)}`);
        }
      }
    }
  } catch (error: any) {
    logger.error(`❌ Error in user connection test: ${error.message}`);
  }
}

async function main() {
  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Get email from command line argument or use a default
    const userEmail = process.argv[2] || "test@example.com"; 
    const discordHandle = process.argv[3]; // Optional

    // Run the test
    await testUserConnection(userEmail, discordHandle);

    // Disconnect from MongoDB
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  } catch (error: any) {
    logger.error(`Unexpected error: ${error.message}`);
  }
}

// Run the main function
main().catch(error => {
  logger.error("Error in main:", error);
  process.exit(1);
}); 