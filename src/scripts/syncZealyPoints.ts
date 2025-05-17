import axios from "axios";
import { zealyConfig } from "../config/zealy";
import { User } from "../models/User";
import logger from "../utils/logger";

async function syncZealyPoints() {
  try {
    logger.info("Starting Zealy points synchronization");

    // Fetch the leaderboard from Zealy API
    const leaderboardResponse = await axios.get(
      `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/leaderboard`,
      {
        params: {
          page: 1,
          limit: 100 // Adjust as needed
        },
        headers: {
          "x-api-key": zealyConfig.apiKey
        }
      }
    );

    if (!leaderboardResponse.data || !leaderboardResponse.data.data) {
      logger.error("Invalid leaderboard response from Zealy API");
      return;
    }

    const leaderboard = leaderboardResponse.data.data;
    logger.info(`Retrieved ${leaderboard.length} users from Zealy leaderboard`);

    let updatedCount = 0;
    let errorCount = 0;
    let notFoundCount = 0;

    // Process each user in the leaderboard
    for (const zealyUser of leaderboard) {
      try {
        if (!zealyUser.userId) {
          logger.warn("Skipping leaderboard entry with missing userId");
          continue;
        }

        // Find user in our database with matching zealy_id
        const user = await User.findOne({ zealy_id: zealyUser.userId });
        
        if (!user) {
          notFoundCount++;
          logger.debug(`No user found with Zealy ID: ${zealyUser.userId}`);
          continue;
        }

        // Update user points using the setZealyPoints method
        await user.setZealyPoints(zealyUser.xp || 0);
        
        // Update discord handle if available and different
        if (zealyUser.discordHandle && zealyUser.discordHandle !== user.discord_handle) {
          user.discord_handle = zealyUser.discordHandle;
          await user.save();
        }

        updatedCount++;
        logger.debug(`Updated points for user ${user._id}: ${zealyUser.xp} points`);
      } catch (error) {
        errorCount++;
        logger.error(`Error updating user with Zealy ID ${zealyUser.userId}:`, error);
      }
    }

    logger.info(`Zealy points synchronization completed. Updated: ${updatedCount}, Not found: ${notFoundCount}, Errors: ${errorCount}`);
  } catch (error) {
    logger.error("Error during Zealy points synchronization:", error);
  }
}

// Execute the script
syncZealyPoints();
