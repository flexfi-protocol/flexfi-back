// src/tests/models/apiKey.test.ts
import { ApiKey, IApiKey } from '../../models/ApiKey';
import { Merchant } from '../../models/Merchant';
import mongoose from 'mongoose';

describe('ApiKey Model', () => {
  let merchantId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    // Créer un marchand pour les tests
    const merchant = await Merchant.create({
      businessName: 'Test Store',
      email: 'test@store.com',
      country: 'FR',
      registrationNumber: 'SIRET123456789',
      address: {
        street: '123 Test Street',
        city: 'Paris',
        postalCode: '75001',
        country: 'France'
      },
      contactPerson: 'John Doe',
      publicKey: '11111111111111111111111111111112'
    });
    
    merchantId = merchant._id as mongoose.Types.ObjectId;
  });

  describe('🔑 API Key Generation', () => {
    test('should generate test API key', () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('test');
      
      expect(keyId).toMatch(/^ak_[a-f0-9]{32}$/);
      expect(fullKey).toMatch(/^sk_test_[a-f0-9]{48}$/);
      expect(fullKey.length).toBe(56); // sk_test_ (8) + 48 chars
    });

    test('should generate live API key', () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('live');
      
      expect(keyId).toMatch(/^ak_[a-f0-9]{32}$/);
      expect(fullKey).toMatch(/^sk_live_[a-f0-9]{48}$/);
      expect(fullKey.length).toBe(56); // sk_live_ (8) + 48 chars
    });

    test('should generate unique keys', () => {
      const key1 = (ApiKey as any).generateApiKey('test');
      const key2 = (ApiKey as any).generateApiKey('test');
      
      expect(key1.keyId).not.toBe(key2.keyId);
      expect(key1.fullKey).not.toBe(key2.fullKey);
    });
  });

  describe('🔒 Key Hashing', () => {
    test('should hash API key', async () => {
      const testKey = 'sk_test_123456789abcdef123456789abcdef123456789abcdef12';
      const hash = await (ApiKey as any).hashKey(testKey);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(testKey);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash length
    });

    test('should produce different hashes for same key', async () => {
      const testKey = 'sk_test_123456789abcdef123456789abcdef123456789abcdef12';
      const hash1 = await (ApiKey as any).hashKey(testKey);
      const hash2 = await (ApiKey as any).hashKey(testKey);
      
      expect(hash1).not.toBe(hash2); // bcrypt uses salt
    });
  });

  describe('✅ Valid ApiKey Creation', () => {
    test('should create valid test API key', async () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('test');
      const keyHash = await (ApiKey as any).hashKey(fullKey);
      
      const apiKey = new ApiKey({
        merchantId,
        keyId,
        keyHash,
        keyPrefix: 'sk_test_',
        name: 'Test API Key'
      });
      
      const savedApiKey = await apiKey.save();
      
      expect(savedApiKey._id).toBeDefined();
      expect(savedApiKey.merchantId).toEqual(merchantId);
      expect(savedApiKey.keyId).toBe(keyId);
      expect(savedApiKey.keyPrefix).toBe('sk_test_');
      expect(savedApiKey.name).toBe('Test API Key');
      expect(savedApiKey.isActive).toBe(true); // Default
      expect(savedApiKey.usageCount).toBe(0); // Default
      expect(savedApiKey.createdAt).toBeDefined();
    });

    test('should create valid live API key', async () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('live');
      const keyHash = await (ApiKey as any).hashKey(fullKey);
      
      const apiKey = new ApiKey({
        merchantId,
        keyId,
        keyHash,
        keyPrefix: 'sk_live_',
        name: 'Production API Key'
      });
      
      const savedApiKey = await apiKey.save();
      
      expect(savedApiKey.keyPrefix).toBe('sk_live_');
      expect(savedApiKey.name).toBe('Production API Key');
    });
  });

  describe('❌ Invalid ApiKey Creation', () => {
    test('should fail without required fields', async () => {
      const apiKey = new ApiKey({});
      
      await expect(apiKey.save()).rejects.toThrow();
    });

    test('should fail with invalid keyPrefix', async () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('test');
      const keyHash = await (ApiKey as any).hashKey(fullKey);
      
      const apiKey = new ApiKey({
        merchantId,
        keyId,
        keyHash,
        keyPrefix: 'invalid_prefix_' as any,
        name: 'Test Key'
      });
      
      await expect(apiKey.save()).rejects.toThrow();
    });

    test('should fail with duplicate keyId', async () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('test');
      const keyHash = await (ApiKey as any).hashKey(fullKey);
      
      // Créer la première clé
      const apiKey1 = new ApiKey({
        merchantId,
        keyId,
        keyHash,
        keyPrefix: 'sk_test_',
        name: 'Test Key 1'
      });
      await apiKey1.save();
      
      // Essayer de créer une seconde avec le même keyId
      const apiKey2 = new ApiKey({
        merchantId,
        keyId, // Même keyId
        keyHash,
        keyPrefix: 'sk_test_',
        name: 'Test Key 2'
      });
      
      await expect(apiKey2.save()).rejects.toThrow();
    });
  });

  describe('🔍 Key Verification', () => {
    let savedApiKey: IApiKey;
    let originalKey: string;

    beforeEach(async () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('test');
      const keyHash = await (ApiKey as any).hashKey(fullKey);
      
      savedApiKey = await ApiKey.create({
        merchantId,
        keyId,
        keyHash,
        keyPrefix: 'sk_test_',
        name: 'Test Key'
      });
      
      originalKey = fullKey;
    });

    test('should verify correct key', async () => {
      const isValid = await savedApiKey.verifyKey(originalKey);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect key', async () => {
      const wrongKey = 'sk_test_wrongkey123456789abcdef123456789abcdef123456';
      const isValid = await savedApiKey.verifyKey(wrongKey);
      expect(isValid).toBe(false);
    });
  });

  describe('🔍 ApiKey Queries', () => {
    beforeEach(async () => {
      // Créer plusieurs clés API
      const keys = await Promise.all([
        (ApiKey as any).generateApiKey('test'),
        (ApiKey as any).generateApiKey('live'),
        (ApiKey as any).generateApiKey('test')
      ]);
      
      for (let i = 0; i < keys.length; i++) {
        const { keyId, fullKey } = keys[i];
        const keyHash = await (ApiKey as any).hashKey(fullKey);
        
        await ApiKey.create({
          merchantId,
          keyId,
          keyHash,
          keyPrefix: i === 1 ? 'sk_live_' : 'sk_test_',
          name: `Test Key ${i + 1}`,
          isActive: i !== 2 // Désactiver la 3ème clé
        });
      }
    });

    test('should find keys by merchant', async () => {
      const apiKeys = await ApiKey.find({ merchantId });
      expect(apiKeys).toHaveLength(3);
    });

    test('should find only active keys', async () => {
      const activeKeys = await ApiKey.find({ merchantId, isActive: true });
      expect(activeKeys).toHaveLength(2);
    });

    test('should find keys by prefix', async () => {
      const testKeys = await ApiKey.find({ keyPrefix: 'sk_test_' });
      const liveKeys = await ApiKey.find({ keyPrefix: 'sk_live_' });
      
      expect(testKeys).toHaveLength(2);
      expect(liveKeys).toHaveLength(1);
    });
  });

  describe('🔄 ApiKey Updates', () => {
    test('should update usage count and lastUsed', async () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('test');
      const keyHash = await (ApiKey as any).hashKey(fullKey);
      
      const apiKey = await ApiKey.create({
        merchantId,
        keyId,
        keyHash,
        keyPrefix: 'sk_test_',
        name: 'Test Key'
      });
      
      expect(apiKey.usageCount).toBe(0);
      expect(apiKey.lastUsed).toBeUndefined();
      
      // Simuler une utilisation
      const updatedKey = await ApiKey.findByIdAndUpdate(
        apiKey._id,
        {
          lastUsed: new Date(),
          $inc: { usageCount: 1 }
        },
        { new: true }
      );
      
      expect(updatedKey?.usageCount).toBe(1);
      expect(updatedKey?.lastUsed).toBeDefined();
    });

    test('should deactivate API key', async () => {
      const { keyId, fullKey } = (ApiKey as any).generateApiKey('test');
      const keyHash = await (ApiKey as any).hashKey(fullKey);
      
      const apiKey = await ApiKey.create({
        merchantId,
        keyId,
        keyHash,
        keyPrefix: 'sk_test_',
        name: 'Test Key'
      });
      
      expect(apiKey.isActive).toBe(true);
      
      const deactivatedKey = await ApiKey.findByIdAndUpdate(
        apiKey._id,
        { isActive: false },
        { new: true }
      );
      
      expect(deactivatedKey?.isActive).toBe(false);
    });
  });
});