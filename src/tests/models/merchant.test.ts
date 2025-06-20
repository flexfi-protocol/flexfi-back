// src/tests/models/merchant.test.ts
import { Merchant, IMerchant } from '../../models/Merchant';

describe('Merchant Model', () => {
  const validMerchantData = {
    businessName: 'Test Store',
    email: 'test@store.com',
    country: 'FR' as const,
    registrationNumber: 'SIRET123456789',
    address: {
      street: '123 Test Street',
      city: 'Paris',
      postalCode: '75001',
      country: 'France'
    },
    contactPerson: 'John Doe',
    publicKey: '11111111111111111111111111111112' // Valid Solana key format
  };

  describe('✅ Valid Merchant Creation', () => {
    test('should create a valid merchant', async () => {
      const merchant = new Merchant(validMerchantData);
      const savedMerchant = await merchant.save();

      expect(savedMerchant._id).toBeDefined();
      expect(savedMerchant.businessName).toBe('Test Store');
      expect(savedMerchant.email).toBe('test@store.com');
      expect(savedMerchant.country).toBe('FR');
      expect(savedMerchant.status).toBe('pending'); // Default status
      expect(savedMerchant.isVerified).toBe(false); // Default verification
      expect(savedMerchant.createdAt).toBeDefined();
      expect(savedMerchant.updatedAt).toBeDefined();
    });

    test('should normalize email to lowercase', async () => {
      const merchantData = {
        ...validMerchantData,
        email: 'TEST@STORE.COM'
      };
      
      const merchant = new Merchant(merchantData);
      const savedMerchant = await merchant.save();

      expect(savedMerchant.email).toBe('test@store.com');
    });
  });

  describe('❌ Invalid Merchant Creation', () => {
    test('should fail without required fields', async () => {
      const merchant = new Merchant({});
      
      await expect(merchant.save()).rejects.toThrow();
    });

    test('should fail with invalid email', async () => {
      const merchantData = {
        ...validMerchantData,
        email: 'invalid-email'
      };
      
      const merchant = new Merchant(merchantData);
      await expect(merchant.save()).rejects.toThrow();
    });

    test('should fail with invalid country', async () => {
      const merchantData = {
        ...validMerchantData,
        country: 'INVALID' as any
      };
      
      const merchant = new Merchant(merchantData);
      await expect(merchant.save()).rejects.toThrow();
    });

    test('should fail with invalid Solana public key', async () => {
      const merchantData = {
        ...validMerchantData,
        publicKey: 'invalid-solana-key'
      };
      
      const merchant = new Merchant(merchantData);
      await expect(merchant.save()).rejects.toThrow(/Invalid Solana public key format/);
    });

    test('should fail with duplicate email', async () => {
      // Créer le premier marchand
      const merchant1 = new Merchant(validMerchantData);
      await merchant1.save();

      // Essayer de créer un second avec le même email
      const merchant2 = new Merchant({
        ...validMerchantData,
        businessName: 'Another Store'
      });

      await expect(merchant2.save()).rejects.toThrow();
    });
  });

  describe('🔍 Merchant Queries', () => {
    beforeEach(async () => {
      // Créer des marchands de test
      await Merchant.create([
        { ...validMerchantData, businessName: 'Store 1', email: 'store1@test.com' },
        { ...validMerchantData, businessName: 'Store 2', email: 'store2@test.com', country: 'BR' },
        { ...validMerchantData, businessName: 'Store 3', email: 'store3@test.com', status: 'active' }
      ]);
    });

    test('should find merchant by email', async () => {
      const merchant = await Merchant.findOne({ email: 'store1@test.com' });
      
      expect(merchant).toBeTruthy();
      expect(merchant?.businessName).toBe('Store 1');
    });

    test('should find merchants by country', async () => {
      const frenchMerchants = await Merchant.find({ country: 'FR' });
      const brazilianMerchants = await Merchant.find({ country: 'BR' });
      
      expect(frenchMerchants).toHaveLength(2);
      expect(brazilianMerchants).toHaveLength(1);
    });

    test('should find merchants by status', async () => {
      const pendingMerchants = await Merchant.find({ status: 'pending' });
      const activeMerchants = await Merchant.find({ status: 'active' });
      
      expect(pendingMerchants).toHaveLength(2);
      expect(activeMerchants).toHaveLength(1);
    });
  });

  describe('🔄 Merchant Updates', () => {
    test('should update merchant status', async () => {
      const merchant = new Merchant(validMerchantData);
      await merchant.save();

      const updatedMerchant = await Merchant.findByIdAndUpdate(
        merchant._id,
        { status: 'active', isVerified: true },
        { new: true }
      );

      expect(updatedMerchant?.status).toBe('active');
      expect(updatedMerchant?.isVerified).toBe(true);
    });

    test('should update updatedAt timestamp', async () => {
      const merchant = new Merchant(validMerchantData);
      await merchant.save();
      const originalUpdatedAt = merchant.updatedAt;

      // Attendre un peu pour voir la différence
      await new Promise(resolve => setTimeout(resolve, 10));

      merchant.businessName = 'Updated Store Name';
      await merchant.save();

      expect(merchant.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});