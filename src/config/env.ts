import dotenv from "dotenv";
import { cleanEnv, port, str, url } from "envalid";

// ==========================================
// Chargement des variables d'environnement
// ==========================================
dotenv.config();

// ==========================================
// Validation des variables d'environnement
// ==========================================
const env = cleanEnv(process.env, {
  // ==========================================
  // Configuration Serveur
  // ==========================================
  PORT: port({ default: 3000 }),
  NODE_ENV: str({
    choices: ["development", "test", "production"],
    default: "development",
  }),

  // ==========================================
  // Configuration Base de données
  // ==========================================
  MONGODB_URI: process.env.NODE_ENV === 'test' ? str({ default: 'memory' }) : url(),

  // ==========================================
  // Configuration Authentification
  // ==========================================
  JWT_SECRET: str({ default: process.env.NODE_ENV === 'test' ? 'test-jwt-secret' : undefined }),
  JWT_EXPIRES_IN: str({ default: "7d" }),

  // ==========================================
  // Configuration Chiffrement
  // ==========================================
  ENCRYPTION_KEY: str({ default: process.env.NODE_ENV === 'test' ? 'test-encryption-key-32-chars-long' : undefined }),

  // ==========================================
  // Configuration Solana
  // ==========================================
  SOLANA_RPC_URL: url({ default: "https://api.devnet.solana.com" }),
  SOLANA_NETWORK: str({
    choices: ["devnet", "testnet", "mainnet-beta"],
    default: "devnet",
  }),
  FLEXFI_DELEGATE_PUBKEY: str({ default: "" }),
  FLEXFI_DELEGATE_PRIVATE_KEY: str({ default: "" }),

  // ==========================================
  // Configuration OAuth - Google
  // ==========================================
  GOOGLE_CLIENT_ID: str({ default: "" }),
  GOOGLE_CLIENT_SECRET: str({ default: "" }),
  GOOGLE_CALLBACK_URL: str({
    default: "http://localhost:3000/api/auth/google/callback",
  }),

  // ==========================================
  // Configuration OAuth - Apple
  // ==========================================
  APPLE_CLIENT_ID: str({ default: "" }),
  APPLE_TEAM_ID: str({ default: "" }),
  APPLE_KEY_ID: str({ default: "" }),
  APPLE_PRIVATE_KEY_LOCATION: str({ default: "" }),
  APPLE_CALLBACK_URL: str({
    default: "http://localhost:3000/api/auth/apple/callback",
  }),

  // ==========================================
  // Configuration OAuth - Twitter
  // ==========================================
  TWITTER_CONSUMER_KEY: str({ default: "" }),
  TWITTER_CONSUMER_SECRET: str({ default: "" }),
  TWITTER_CALLBACK_URL: str({
    default: "http://localhost:3000/api/auth/twitter/callback",
  }),

  // ==========================================
  // Configuration OAuth - Zealy
  // ==========================================
  ZEALY_CLIENT_ID: str({ default: "" }),
  ZEALY_CLIENT_SECRET: str({ default: "" }),
  ZEALY_REDIRECT_URI: str({
    default: "http://localhost:3000/api/zealy/callback",
  }),
  ZEALY_FRONTEND_REDIRECT_URL: str({
    default: "http://localhost:5173/dashboard",
  }),
  ZEALY_API_KEY: str({ default: "" }),
  ZEALY_COMMUNITY_ID: str({ default: "" }),
  ZEALY_API_URL: url({ default: "https://api-v2.zealy.io" }),

  // ==========================================
  // Configuration Brevo
  // ==========================================
  BREVO_API_KEY: str({ default: "" }),
  BREVO_TEMPLATE_SIGNUP_ID: str({ default: "" }),
  BREVO_TEMPLATE_RESET_PASSWORD_ID: str({ default: "" }),
  BREVO_TEMPLATE_ZEALY_ID: str({ default: "" }),
});

export default env;
