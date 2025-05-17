import { zealyConfig } from '../config/zealy';
import logger from './logger';

/**
 * Rate limiting for API requests
 * Simple in-memory implementation
 */
const requestCounts: Record<string, { count: number, resetTime: number }> = {};

export const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  
  // Clean up expired entries
  Object.keys(requestCounts).forEach(key => {
    if (requestCounts[key].resetTime < now) {
      delete requestCounts[key];
    }
  });
  
  // Initialize or get current count
  if (!requestCounts[userId] || requestCounts[userId].resetTime < now) {
    requestCounts[userId] = {
      count: 1,
      resetTime: now + windowMs
    };
    return true;
  }
  
  // Check if limit exceeded
  if (requestCounts[userId].count >= zealyConfig.security.maxRequestsPerMinute) {
    logger.warn(`Rate limit exceeded for user ${userId}`);
    return false;
  }
  
  // Increment count
  requestCounts[userId].count++;
  return true;
}; 