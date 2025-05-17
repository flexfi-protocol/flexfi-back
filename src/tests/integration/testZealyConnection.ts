import axios from "axios";
import { zealyConfig } from "../config/zealy";
import logger from "../utils/logger";

async function testZealyConnection() {
  logger.info("Starting Zealy API connection test");

  try {
    // Test 1: Get community info (public endpoint)
    logger.info("Test 1: Fetching community info");
    const communityResponse = await axios.get(
      `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}`,
      {
        headers: {
          "x-api-key": zealyConfig.apiKey
        }
      }
    );
    
    logger.info(`✅ Successfully connected to Zealy community: ${communityResponse.data.name}`);
    logger.info(`Community details: ${communityResponse.data.subdomain}, Total members: ${communityResponse.data.totalMembers}`);

    // Test 2: Fetch leaderboard
    logger.info("Test 2: Fetching leaderboard");
    const leaderboardResponse = await axios.get(
      `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/leaderboard`,
      {
        params: {
          page: 1,
          limit: 10
        },
        headers: {
          "x-api-key": zealyConfig.apiKey
        }
      }
    );
    
    if (leaderboardResponse.data && leaderboardResponse.data.data) {
      const users = leaderboardResponse.data.data;
      logger.info(`✅ Successfully fetched leaderboard: ${users.length} users found`);
      if (users.length > 0) {
        logger.info(`Top user: ${users[0].name} with ${users[0].xp} XP`);
      }
    } else {
      logger.warn("⚠️ Leaderboard response doesn't contain expected data structure");
    }

    // Test 3: List quests
    logger.info("Test 3: Fetching quests");
    try {
      const questsResponse = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/quests`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey
          }
        }
      );
      
      logger.info(`✅ Successfully fetched quests: ${questsResponse.data.length} quests found`);
    } catch (error: any) {
      logger.warn(`⚠️ Quest listing test failed: ${error.response?.data?.message || error.message}`);
      logger.info("Note: Quest listing might require admin privileges");
    }

    // Test 4: List available webhook event types
    logger.info("Test 4: Fetching webhook event types");
    try {
      const webhookTypesResponse = await axios.get(
        `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/webhooks-event-types`,
        {
          headers: {
            "x-api-key": zealyConfig.apiKey
          }
        }
      );
      
      logger.info(`✅ Successfully fetched webhook event types: ${webhookTypesResponse.data.length} types found`);
      logger.info(`Available event types: ${webhookTypesResponse.data.join(', ')}`);
    } catch (error: any) {
      logger.warn(`⚠️ Webhook event types test failed: ${error.response?.data?.message || error.message}`);
      logger.info("Note: Webhook management might require admin privileges");
    }

    logger.info("Zealy API connection tests completed");
    logger.info("------------------------------------");
    logger.info("SUMMARY:");
    logger.info("✅ API connectivity: Success");
    logger.info(`✅ Community connection: Success (${communityResponse.data.name})`);
    logger.info(`✅ Leaderboard access: ${leaderboardResponse.data && leaderboardResponse.data.data ? 'Success' : 'Failed'}`);
    logger.info("Note: Some endpoints may require admin access to the Zealy community");
    logger.info("If you experienced issues, verify your API key has appropriate permissions");

  } catch (error: any) {
    logger.error("❌ Zealy API connection test failed:");
    
    if (error.response) {
      // The request was made and the server responded with a status code outside of 2xx
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Data: ${JSON.stringify(error.response.data)}`);
      logger.error(`Headers: ${JSON.stringify(error.response.headers)}`);
      
      if (error.response.status === 401 || error.response.status === 403) {
        logger.error("Authentication error: Check your API key and permissions");
      } else if (error.response.status === 404) {
        logger.error(`Resource not found: Check your community ID (${zealyConfig.communityId})`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      logger.error("No response received from Zealy API");
      logger.error(`Check your API URL: ${zealyConfig.apiUrl}`);
    } else {
      // Something happened in setting up the request
      logger.error(`Error message: ${error.message}`);
    }
    
    logger.error(`Config used: API URL=${zealyConfig.apiUrl}, Community ID=${zealyConfig.communityId}`);
    logger.error("API key check: " + (zealyConfig.apiKey ? "Present" : "Missing"));
  }
}

// Run the test
testZealyConnection(); 