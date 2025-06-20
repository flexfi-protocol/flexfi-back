// // // tests/setup.ts
// // import dotenv from "dotenv";

// // // Charger les variables d'environnement pour les tests
// // dotenv.config({ path: ".env.test" });

// // // Export a function for globalSetup
// // module.exports = async () => {
// //   // Any global setup that needs to run before Jest loads
// //   console.log("Global setup complete");
// // };

// // // Only run setTimeout in the test environment context, not in global setup
// // if (typeof jest !== "undefined") {
// //   // This will only run when the file is used in setupFilesAfterEnv
// //   jest.setTimeout(30000);
// // }

// // src/tests/setup.ts
// import { MongoMemoryServer } from 'mongodb-memory-server';
// import mongoose from 'mongoose';
// import dotenv from 'dotenv';

// // Charger les variables d'environnement de test
// dotenv.config({ path: '.env.test' });

// let mongod: MongoMemoryServer;

// // Setup global avant tous les tests
// beforeAll(async () => {
//   console.log('🚀 Setting up test environment...');
  
//   // Créer une instance MongoDB en mémoire
//   mongod = await MongoMemoryServer.create();
//   const uri = mongod.getUri();
  
//   // Se connecter à la base de test
//   await mongoose.connect(uri);
//   console.log('✅ Connected to test database');
// }, 30000);

// // Cleanup après tous les tests
// afterAll(async () => {
//   console.log('🧹 Cleaning up test environment...');
  
//   // Fermer la connexion
//   await mongoose.connection.dropDatabase();
//   await mongoose.connection.close();
  
//   // Arrêter le serveur MongoDB
//   await mongod.stop();
//   console.log('✅ Test cleanup completed');
// }, 30000);

// // Nettoyer les collections entre chaque test
// afterEach(async () => {
//   const collections = mongoose.connection.collections;
  
//   for (const key in collections) {
//     const collection = collections[key];
//     await collection.deleteMany({});
//   }
// });

// // Configuration globale Jest
// jest.setTimeout(30000);
// tests/setup.ts
import dotenv from "dotenv";

// ✅ Configurer les variables d'environnement AVANT tout import
process.env.NODE_ENV = 'test';

// Variables d'environnement obligatoires pour les tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-12345';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-chars-long';
process.env.WALLET_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'cd38902592350e1ebb4ad170c815ce12a4f3f718aa367d95a4d7363d4d7d6afe';
process.env.MONGODB_URI = 'memory'; // Utiliser la base en mémoire

// Charger les variables d'environnement pour les tests
dotenv.config({ path: ".env.test" });

// Maintenant importer le reste
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

// Configuration Jest
jest.setTimeout(30000);

// Global setup
beforeAll(async () => {
  console.log('🚀 Setting up test environment...');
  
  try {
    // Démarrer MongoDB en mémoire
    mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.4'
      },
      instance: {
        dbName: 'flexfi-test'
      }
    });
    
    const mongoUri = mongoServer.getUri();
    
    // Se connecter à MongoDB
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to test database');
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    throw error;
  }
});

// Nettoyer après chaque test
afterEach(async () => {
  try {
    // Nettoyer toutes les collections
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (error) {
    console.warn('Warning: Failed to clean up test data:', error);
  }
});

// Global teardown
afterAll(async () => {
  console.log('🧹 Cleaning up test environment...');
  
  try {
    // Fermer la connexion mongoose
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    
    // Arrêter le serveur MongoDB en mémoire
    if (mongoServer) {
      await mongoServer.stop();
    }
    
    console.log('✅ Test cleanup completed');
  } catch (error) {
    console.error('❌ Test cleanup failed:', error);
  }
});