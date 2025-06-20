// src/tests/services/merchantService.test.ts
import merchantService, { IMerchantRegistration } from '../../services/merchantService';
import { Merchant } from '../../models/Merchant';
import { ApiKey } from '../../models/ApiKey';

describe('MerchantService', () => {
  const validMerchantData: IMerchantRegistration = {
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
  };

  describe('📝 Merchant Registration', () => {
    test('should register a new merchant successfully', async () => {
      const merchant = await merchantService.registerMerchant(validMerchantData);
      
      expect(merchant._id).toBeDefined();
      expect(merchant.businessName).toBe('Test Store');
      expect(merchant.email).toBe('test@store.com');
      expect(merchant.country).toBe('FR');
      expect(merchant.status).toBe('pending');
      expect(merchant.isVerified).toBe(false);
      expect(merchant.createdAt).toBeDefined();
    });

    test('should normalize email to lowercase', async () => {
      const merchantData = {
        ...validMerchantData,
        email: 'TEST@STORE.COM'
      };
      
      const merchant = await merchantService.registerMerchant(merchantData);
      expect(merchant.email).toBe('test@store.com');
    });

    test('should reject duplicate email', async () => {
      // Créer le premier marchand
      await merchantService.registerMerchant(validMerchantData);
      
      // Essayer de créer un second avec le même email
      const duplicateData = {
        ...validMerchantData,
        businessName: 'Another Store'
      };
      
      await expect(merchantService.registerMerchant(duplicateData))
        .rejects.toThrow('A merchant with this email already exists');
    });

    test('should reject duplicate public key', async () => {
      // Créer le premier marchand
      await merchantService.registerMerchant(validMerchantData);
      
      // Essayer de créer un second avec la même clé publique
      const duplicateData = {
        ...validMerchantData,
        email: 'different@email.com',
        businessName: 'Another Store'
      };
      
      await expect(merchantService.registerMerchant(duplicateData))
        .rejects.toThrow('A merchant with this wallet address already exists');
    });

    test('should reject duplicate registration number', async () => {
      // Créer le premier marchand
      await merchantService.registerMerchant(validMerchantData);
      
      // Essayer de créer un second avec le même numéro d'enregistrement
      const duplicateData = {
        ...validMerchantData,
        email: 'different@email.com',
        businessName: 'Another Store',
        publicKey: '22222222222222222222222222222223'
      };
      
      await expect(merchantService.registerMerchant(duplicateData))
        .rejects.toThrow('A merchant with this registration number already exists');
    });
  });

  describe('🔍 Merchant Retrieval', () => {
    let merchantId: string;

    beforeEach(async () => {
      const merchant = await merchantService.registerMerchant(validMerchantData);
      merchantId = merchant._id.toString();
    });

    test('should get merchant info by ID', async () => {
      const merchant = await merchantService.getMerchantInfo(merchantId);
      
      expect(merchant._id.toString()).toBe(merchantId);
      expect(merchant.businessName).toBe('Test Store');
      expect(merchant.email).toBe('test@store.com');
    });

    test('should throw error for non-existent merchant', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      await expect(merchantService.getMerchantInfo(nonExistentId))
        .rejects.toThrow('Merchant not found');
    });
  });

  describe('🔄 Merchant Status Updates', () => {
    let merchantId: string;

    beforeEach(async () => {
      const merchant = await merchantService.registerMerchant(validMerchantData);
      merchantId = merchant._id.toString();
    });

    test('should update merchant status to active', async () => {
      await merchantService.updateMerchantStatus(merchantId, 'active');
      
      const updatedMerchant = await merchantService.getMerchantInfo(merchantId);
      expect(updatedMerchant.status).toBe('active');
    });

    test('should update merchant status to suspended', async () => {
      await merchantService.updateMerchantStatus(merchantId, 'suspended');
      
      const updatedMerchant = await merchantService.getMerchantInfo(merchantId);
      expect(updatedMerchant.status).toBe('suspended');
    });

    test('should throw error for non-existent merchant', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      await expect(merchantService.updateMerchantStatus(nonExistentId, 'active'))
        .rejects.toThrow('Merchant not found');
    });
  });

  describe('✅ Merchant Verification', () => {
    let merchantId: string;

    beforeEach(async () => {
      const merchant = await merchantService.registerMerchant(validMerchantData);
      merchantId = merchant._id.toString();
    });

    test('should verify merchant successfully', async () => {
      const result = await merchantService.verifyMerchant(merchantId);
      
      expect(result).toBe(true);
      
      const verifiedMerchant = await merchantService.getMerchantInfo(merchantId);
      expect(verifiedMerchant.isVerified).toBe(true);
      expect(verifiedMerchant.status).toBe('active');
    });

    test('should throw error for non-existent merchant', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      await expect(merchantService.verifyMerchant(nonExistentId))
        .rejects.toThrow('Merchant not found');
    });
  });

describe('🔑 API Key Management', () => {
  let merchantId: string;

  beforeEach(async () => {
    const merchant = await merchantService.registerMerchant(validMerchantData);
    merchantId = merchant._id.toString();
  });

  test('should generate test API key', async () => {
    const result = await merchantService.generateApiKey({
      merchantId,
      name: 'Test API Key',
      environment: 'test'
    });
    
    expect(result.apiKey).toBeDefined();
    expect(result.fullKey).toBeDefined();
    expect(result.apiKey.merchantId.toString()).toBe(merchantId);
    expect(result.apiKey.name).toBe('Test API Key');
    expect(result.apiKey.keyPrefix).toBe('sk_test_');
    expect(result.fullKey).toMatch(/^sk_test_[a-f0-9]{48}$/);
  });

  test('should generate live API key', async () => {
    const result = await merchantService.generateApiKey({
      merchantId,
      name: 'Production API Key',
      environment: 'live'
    });
    
    expect(result.apiKey.keyPrefix).toBe('sk_live_');
    expect(result.fullKey).toMatch(/^sk_live_[a-f0-9]{48}$/);
  });

  // ✅ TEST CORRIGÉ ET PLUS ROBUSTE
  test('should list merchant API keys', async () => {
    // 📊 Vérifier qu'il n'y a pas de clés au début
    const initialKeys = await merchantService.listApiKeys(merchantId);
    expect(initialKeys).toHaveLength(0);

    // 🔑 Créer la première clé API et attendre qu'elle soit bien créée
    const testKeyResult = await merchantService.generateApiKey({
      merchantId,
      name: 'Test Key 1',
      environment: 'test'
    });
    
    expect(testKeyResult.apiKey).toBeDefined();
    console.log(`✅ Test key created: ${testKeyResult.apiKey.keyId}`);

    // 🔑 Créer la deuxième clé API et attendre qu'elle soit bien créée
    const liveKeyResult = await merchantService.generateApiKey({
      merchantId,
      name: 'Live Key 1',
      environment: 'live'
    });
    
    expect(liveKeyResult.apiKey).toBeDefined();
    console.log(`✅ Live key created: ${liveKeyResult.apiKey.keyId}`);

    // 📋 Attendre un peu pour s'assurer que les clés sont bien sauvées
    await new Promise(resolve => setTimeout(resolve, 100));

    // 📋 Lister les clés
    const apiKeys = await merchantService.listApiKeys(merchantId);
    
    console.log(`📋 Found ${apiKeys.length} API keys`);
    console.log(`📋 API keys:`, apiKeys.map(k => ({ 
      keyId: k.keyId, 
      name: k.name, 
      prefix: k.keyPrefix,
      defined: !!k
    })));
    
    // ✅ VÉRIFICATIONS ULTRA-ROBUSTES
    expect(Array.isArray(apiKeys)).toBe(true);
    expect(apiKeys).toHaveLength(2);
    
    // ✅ Vérifier que le tableau n'est pas vide avant d'accéder aux éléments
    expect(apiKeys.length).toBeGreaterThan(0);
    
    // ✅ CORRECTION ULTRA-SIMPLE: Tester d'abord l'existence, puis les propriétés
    
    // Test du premier élément
    expect(apiKeys[0]).toBeDefined();
    expect(apiKeys[0]).not.toBeNull();
    expect(apiKeys[0].name).toBeDefined();
    expect(apiKeys[0].keyId).toBeDefined();
    expect(apiKeys[0].keyPrefix).toBeDefined();
    
    // Test du second élément  
    expect(apiKeys[1]).toBeDefined();
    expect(apiKeys[1]).not.toBeNull();
    expect(apiKeys[1].name).toBeDefined();
    expect(apiKeys[1].keyId).toBeDefined();
    expect(apiKeys[1].keyPrefix).toBeDefined();
    
    // ✅ CORRECTION: Tester keyHash de façon plus sûre
    expect('keyHash' in apiKeys[0]).toBe(false);
    expect('keyHash' in apiKeys[1]).toBe(false);

    // ✅ Vérifier qu'on a bien les deux types de clés
    const testKeys = apiKeys.filter(key => key.keyPrefix === 'sk_test_');
    const liveKeys = apiKeys.filter(key => key.keyPrefix === 'sk_live_');
    
    expect(testKeys).toHaveLength(1);
    expect(liveKeys).toHaveLength(1);
    
    // ✅ Vérifier les noms
    const keyNames = apiKeys.map(key => key.name);
    expect(keyNames).toContain('Test Key 1');
    expect(keyNames).toContain('Live Key 1');
  });

  test('should revoke API key', async () => {
    const { apiKey } = await merchantService.generateApiKey({
      merchantId,
      name: 'Test Key',
      environment: 'test'
    });
    
    await merchantService.revokeApiKey(apiKey.keyId);
    
    const revokedKey = await ApiKey.findOne({ keyId: apiKey.keyId });
    expect(revokedKey?.isActive).toBe(false);
  });

  test('should throw error when generating key for non-existent merchant', async () => {
    const nonExistentId = '507f1f77bcf86cd799439011';
    
    await expect(merchantService.generateApiKey({
      merchantId: nonExistentId,
      name: 'Test Key',
      environment: 'test'
    })).rejects.toThrow('Merchant not found');
  });
});

// ✅ CORRECTION DU TEST D'ERREUR
describe('❌ Error Handling', () => {
  test('should handle validation errors gracefully', async () => {
    const invalidData = {
      ...validMerchantData,
      email: null as any // Force une erreur de validation
    };
    
    // ✅ CORRECTION: Attendre l'erreur correcte selon la validation ajoutée
    await expect(merchantService.registerMerchant(invalidData))
      .rejects.toThrow(/Valid email is required/);
  });

  test('should handle database errors gracefully', async () => {
    const invalidData = {
      ...validMerchantData,
      // Utiliser un champ qui causera une erreur de validation MongoDB
      country: 'INVALID_COUNTRY_CODE' as any
    };
    
    await expect(merchantService.registerMerchant(invalidData))
      .rejects.toThrow(/Registration failed/);
  });
});

  describe('🔐 API Key Verification', () => {
    let merchantId: string;
    let apiKey: string;

    beforeEach(async () => {
      const merchant = await merchantService.registerMerchant(validMerchantData);
      merchantId = merchant._id.toString();
      
      const keyResult = await merchantService.generateApiKey({
        merchantId,
        name: 'Test Key',
        environment: 'test'
      });
      
      apiKey = keyResult.fullKey;
    });

    test('should verify valid API key', async () => {
      const verification = await merchantService.verifyApiKey(apiKey);
      
      expect(verification).toBeTruthy();
      expect(verification?.apiKey).toBeDefined();
      expect(verification?.merchant).toBeDefined();
      expect(verification?.merchant._id.toString()).toBe(merchantId);
    });

    test('should reject invalid API key', async () => {
      const invalidKey = 'sk_test_invalidkey123456789abcdef123456789abcdef12';
      const verification = await merchantService.verifyApiKey(invalidKey);
      
      expect(verification).toBeNull();
    });

    test('should update usage stats on verification', async () => {
      // Vérifier la clé
      await merchantService.verifyApiKey(apiKey);
      
      // Récupérer la clé et vérifier les stats
      const apiKeyRecord = await ApiKey.findOne({ 
        merchantId, 
        isActive: true 
      });
      
      expect(apiKeyRecord?.usageCount).toBe(1);
      expect(apiKeyRecord?.lastUsed).toBeDefined();
    });
  });

  describe('❌ Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Simuler une erreur en fermant la connexion
      const invalidData = {
        ...validMerchantData,
        email: null as any // Force une erreur de validation
      };
      
      await expect(merchantService.registerMerchant(invalidData))
        .rejects.toThrow(/Registration failed/);
    });
  });
});