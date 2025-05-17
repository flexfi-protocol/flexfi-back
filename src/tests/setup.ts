// tests/setup.ts
import dotenv from "dotenv";

// Charger les variables d'environnement pour les tests
dotenv.config({ path: ".env.test" });

// Export a function for globalSetup
module.exports = async () => {
  // Any global setup that needs to run before Jest loads
  console.log("Global setup complete");
};

// Only run setTimeout in the test environment context, not in global setup
if (typeof jest !== "undefined") {
  // This will only run when the file is used in setupFilesAfterEnv
  jest.setTimeout(30000);
}
