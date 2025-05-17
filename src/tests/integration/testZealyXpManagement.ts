import axios from "axios";
import { zealyConfig } from "../config/zealy";
import logger from "../utils/logger";

// This script tests adding and removing XP for a Zealy user

async function testAddXP(zealyUserId: string, xpAmount: number = 10) {
  logger.info(`Testing adding ${xpAmount} XP to user ${zealyUserId}`);

  try {
    const response = await axios.post(
      `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users/${zealyUserId}/xp`,
      {
        xp: xpAmount,
        label: "API Test",
        description: "XP added via API test script"
      },
      {
        headers: {
          "x-api-key": zealyConfig.apiKey,
          "Content-Type": "application/json"
        }
      }
    );

    logger.info("✅ Successfully added XP:");
    logger.info(`XP added: ${response.data.xp}`);
    logger.info(`Label: ${response.data.label}`);
    logger.info(`Description: ${response.data.description}`);
    logger.info(`Transaction ID: ${response.data.id}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error adding XP: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function testRemoveXP(zealyUserId: string, xpAmount: number = 5) {
  logger.info(`Testing removing ${xpAmount} XP from user ${zealyUserId}`);

  try {
    const response = await axios.delete(
      `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users/${zealyUserId}/xp`,
      {
        headers: {
          "x-api-key": zealyConfig.apiKey,
          "Content-Type": "application/json"
        },
        data: {
          xp: xpAmount,
          label: "API Test",
          description: "XP removed via API test script"
        }
      }
    );

    logger.info("✅ Successfully removed XP:");
    logger.info(`XP removed: ${response.data.xp}`);
    logger.info(`Label: ${response.data.label}`);
    logger.info(`Description: ${response.data.description}`);
    logger.info(`Transaction ID: ${response.data.id}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Error removing XP: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

async function getUserPoints(zealyUserId: string) {
  logger.info(`Getting current XP for user ${zealyUserId}`);

  try {
    const response = await axios.get(
      `${zealyConfig.apiUrl}/public/communities/${zealyConfig.communityId}/users/${zealyUserId}`,
      {
        headers: {
          "x-api-key": zealyConfig.apiKey
        }
      }
    );

    logger.info(`✅ User current XP: ${response.data.xp}`);
    return response.data.xp;
  } catch (error: any) {
    logger.error(`❌ Error getting user XP: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
    return null;
  }
}

async function main() {
  try {
    // Get zealyUserId from command line argument
    const zealyUserId = process.argv[2];
    
    if (!zealyUserId) {
      logger.error("❌ Please provide a Zealy user ID as a command line argument");
      logger.info("Usage: npm run testZealyXp <zealyUserId> [addAmount] [removeAmount]");
      process.exit(1);
    }

    // Get optional XP amounts
    const addAmount = process.argv[3] ? parseInt(process.argv[3]) : 10;
    const removeAmount = process.argv[4] ? parseInt(process.argv[4]) : 5;

    // Get initial points
    const initialPoints = await getUserPoints(zealyUserId);
    
    if (initialPoints === null) {
      logger.error("❌ Could not retrieve initial points. Aborting test.");
      process.exit(1);
    }

    // Test adding XP
    const addSuccess = await testAddXP(zealyUserId, addAmount);
    
    if (addSuccess) {
      // Check points after adding
      const pointsAfterAdd = await getUserPoints(zealyUserId);
      
      if (pointsAfterAdd !== null && initialPoints !== null) {
        const difference = pointsAfterAdd - initialPoints;
        logger.info(`Points before: ${initialPoints}, Points after: ${pointsAfterAdd}`);
        logger.info(`Difference: ${difference} (expected: +${addAmount})`);
        
        if (difference === addAmount) {
          logger.info("✅ XP addition verified successfully!");
        } else {
          logger.warn(`⚠️ XP difference (${difference}) doesn't match added amount (${addAmount})`);
        }
      }
    }

    // Test removing XP
    const removeSuccess = await testRemoveXP(zealyUserId, removeAmount);
    
    if (removeSuccess) {
      // Check points after removing
      const finalPoints = await getUserPoints(zealyUserId);
      
      if (finalPoints !== null && initialPoints !== null) {
        const totalDifference = finalPoints - initialPoints;
        logger.info(`Initial points: ${initialPoints}, Final points: ${finalPoints}`);
        logger.info(`Total difference: ${totalDifference} (expected: ${addAmount - removeAmount})`);
        
        if (totalDifference === (addAmount - removeAmount)) {
          logger.info("✅ XP removal verified successfully!");
        } else {
          logger.warn(`⚠️ Total XP difference (${totalDifference}) doesn't match expected (${addAmount - removeAmount})`);
        }
      }
    }

    // Summary
    logger.info("------------------------------------");
    logger.info("XP MANAGEMENT TEST SUMMARY:");
    logger.info(`✅ Add XP: ${addSuccess ? "Success" : "Failed"}`);
    logger.info(`✅ Remove XP: ${removeSuccess ? "Success" : "Failed"}`);
    
  } catch (error: any) {
    logger.error(`Unexpected error: ${error.message}`);
  }
}

// Run the main function
main().catch(error => {
  logger.error("Error in main:", error);
  process.exit(1);
}); 