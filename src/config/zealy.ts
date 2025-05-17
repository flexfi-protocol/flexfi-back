import env from "./env";

// ==========================================
// Configuration Zealy
// ==========================================

export const zealyConfig = {
  // ==========================================
  // Configuration API
  // ==========================================
  apiKey: env.ZEALY_API_KEY,
  communityId: env.ZEALY_COMMUNITY_ID,
  apiUrl: env.ZEALY_API_URL,

  // ==========================================
  // Configuration OAuth
  // ==========================================
  clientId: env.ZEALY_CLIENT_ID,
  clientSecret: env.ZEALY_CLIENT_SECRET,
  redirectUri: env.ZEALY_REDIRECT_URI,
  frontendRedirectUrl: env.ZEALY_FRONTEND_REDIRECT_URL || "https://www.flex-fi.io/dashboard",
  scopes: ["user:read", "points:read"],

  // ==========================================
  // Endpoints API
  // ==========================================
  endpoints: {
    authorize: "/oauth/authorize",
    token: "/oauth/token",
    user: "/user",
    points: "/points",
  },

  // ==========================================
  // Configuration Synchronisation
  // ==========================================
  sync: {
    interval: 3600000, // 1 heure en millisecondes
    maxRetries: 3,
    retryDelay: 5000, // 5 secondes
  },

  // ==========================================
  // Configuration Sécurité
  // ==========================================
  security: {
    stateExpiration: 3600000, // 1 heure en millisecondes
    maxRequestsPerMinute: 60,
  },
};

export default zealyConfig;
