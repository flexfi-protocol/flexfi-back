import { Merchant, IMerchant } from '../models/Merchant';
import { ApiKey, IApiKey } from '../models/ApiKey';
import { AppError, ConflictError, NotFoundError, InternalError } from '../utils/AppError';
import logger from '../utils/logger';
import mongoose from 'mongoose';

export interface IMerchantRegistration {
  businessName: string;
  email: string;
  country: 'FR' | 'BR' | 'AR';
  registrationNumber: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  contactPerson: string;
  publicKey: string;
}

export interface IApiKeyCreate {
  merchantId: string;
  name: string;
  environment: 'live' | 'test';
}

export class MerchantService {
  
  /**
   * Enregistrer un nouveau marchand
   */
  async registerMerchant(data: IMerchantRegistration): Promise<IMerchant> {
    try {
      // ✅ VALIDATION EN DÉBUT DE FONCTION
      if (!data.email || typeof data.email !== 'string') {
        throw new Error('Valid email is required');
      }
      
      if (!data.businessName || typeof data.businessName !== 'string') {
        throw new Error('Business name is required');
      }

      // Normaliser l'email une seule fois
      const normalizedEmail = data.email.toLowerCase();

      // Vérifier si le marchand existe déjà
      const existingMerchant = await Merchant.findOne({
        $or: [
          { email: normalizedEmail },
          { publicKey: data.publicKey },
          { registrationNumber: data.registrationNumber }
        ]
      });

      if (existingMerchant) {
        if (existingMerchant.email === normalizedEmail) {
          throw ConflictError('A merchant with this email already exists');
        }
        if (existingMerchant.publicKey === data.publicKey) {
          throw ConflictError('A merchant with this wallet address already exists');
        }
        if (existingMerchant.registrationNumber === data.registrationNumber) {
          throw ConflictError('A merchant with this registration number already exists');
        }
      }

      // Créer le nouveau marchand
      const merchant = new Merchant({
        ...data,
        email: normalizedEmail,
        status: 'pending'
      });

      await merchant.save();

      logger.info(`New merchant registered: ${merchant.businessName} (${merchant.email})`);
      
      return merchant;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error('Error registering merchant:', error);
      throw InternalError(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Récupérer les informations d'un marchand
   */
  async getMerchantInfo(merchantId: string): Promise<IMerchant> {
    try {
      const merchant = await Merchant.findById(merchantId);
      
      if (!merchant) {
        throw NotFoundError('Merchant not found');
      }

      return merchant;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Error getting merchant info for ${merchantId}:`, error);
      throw InternalError(`Failed to get merchant info: ${error.message}`);
    }
  }

  /**
   * Mettre à jour le statut d'un marchand
   */
  async updateMerchantStatus(merchantId: string, status: 'pending' | 'active' | 'suspended'): Promise<void> {
    try {
      const merchant = await Merchant.findByIdAndUpdate(
        merchantId,
        { status },
        { new: true }
      );

      if (!merchant) {
        throw NotFoundError('Merchant not found');
      }

      logger.info(`Merchant ${merchantId} status updated to: ${status}`);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Error updating merchant status for ${merchantId}:`, error);
      throw InternalError(`Failed to update merchant status: ${error.message}`);
    }
  }

  /**
   * Générer une nouvelle clé API
   */
  async generateApiKey(data: IApiKeyCreate): Promise<{ apiKey: IApiKey, fullKey: string }> {
    try {
      // Vérifier que le marchand existe
      const merchant = await Merchant.findById(data.merchantId);
      if (!merchant) {
        throw NotFoundError('Merchant not found');
      }

      // Générer la clé API
      const { keyId, fullKey } = (ApiKey as any).generateApiKey(data.environment);
      const keyHash = await (ApiKey as any).hashKey(fullKey);

      // ✅ FIX: S'assurer que merchantId est stocké de manière cohérente
      const apiKey = new ApiKey({
        merchantId: new mongoose.Types.ObjectId(data.merchantId), // ✅ Forcer ObjectId
        keyId,
        keyHash,
        keyPrefix: data.environment === 'live' ? 'sk_live_' : 'sk_test_',
        name: data.name
      });

      await apiKey.save();

      logger.info(`API key generated for merchant ${data.merchantId}: ${keyId}`);

      return { apiKey, fullKey };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error('Error generating API key:', error);
      throw InternalError(`Failed to generate API key: ${error.message}`);
    }
  }

  /**
   * Révoquer une clé API
   */
  async revokeApiKey(keyId: string): Promise<void> {
    try {
      logger.debug(`Revoking API key: ${keyId}`);
      
      const apiKey = await ApiKey.findOneAndUpdate(
        { keyId },
        { isActive: false },
        { new: true }
      );

      if (!apiKey) {
        throw NotFoundError('API key not found');
      }

      logger.info(`API key revoked: ${keyId}`);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Error revoking API key ${keyId}:`, error);
      throw InternalError(`Failed to revoke API key: ${error.message}`);
    }
  }

  /**
   * Lister les clés API d'un marchand
   */
  async listApiKeys(merchantId: string): Promise<IApiKey[]> {
    try {
      logger.debug(`Listing API keys for merchant: ${merchantId}`);
      
      const apiKeys = await ApiKey.find({ 
        $or: [
          { merchantId: merchantId },
          { merchantId: new mongoose.Types.ObjectId(merchantId) }
        ],
        isActive: true 
      }).select('-keyHash').lean(); // ✅ Ajout de .lean() pour forcer l'exclusion
      
      // ✅ CORRECTION : Enlever explicitement keyHash si toujours présent
      const cleanedApiKeys = apiKeys.map(apiKey => {
        const { keyHash, ...cleanApiKey } = apiKey;
        return cleanApiKey;
      });
      
      logger.debug(`Found ${cleanedApiKeys.length} active API keys for merchant ${merchantId}`);
      
      return cleanedApiKeys as IApiKey[];
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Error listing API keys for ${merchantId}:`, error);
      throw InternalError(`Failed to list API keys: ${error.message}`);
    }
  }

  /**
   * Vérifier une clé API
   */
  async verifyApiKey(key: string): Promise<{ apiKey: IApiKey, merchant: IMerchant } | null> {
    try {
      logger.debug(`Verifying API key: ${key.substring(0, 20)}...`);
      
      // ✅ FIX: Chercher toutes les clés actives et tester chacune
      const apiKeys = await ApiKey.find({
        isActive: true
      });

      logger.debug(`Found ${apiKeys.length} active API keys to verify against`);

      // Tester chaque clé
      for (const apiKey of apiKeys) {
        try {
          const isValid = await apiKey.verifyKey(key);
          if (isValid) {
            logger.debug(`API key verified successfully: ${apiKey.keyId}`);
            
            // Récupérer le marchand
            const merchant = await Merchant.findById(apiKey.merchantId);
            if (!merchant) {
              logger.warn(`API key ${apiKey.keyId} has invalid merchant reference`);
              continue;
            }

            // Mettre à jour les stats d'usage
            await ApiKey.findByIdAndUpdate(apiKey._id, {
              lastUsed: new Date(),
              $inc: { usageCount: 1 }
            });

            return {
              apiKey,
              merchant
            };
          }
        } catch (verifyError) {
          logger.debug(`Error verifying key ${apiKey.keyId}:`, verifyError);
          continue;
        }
      }

      logger.debug('No matching API key found');
      return null;
    } catch (error: any) {
      logger.error('Error verifying API key:', error);
      return null;
    }
  }

  /**
   * Vérifier un marchand (processus manuel ou automatique)
   */
  async verifyMerchant(merchantId: string): Promise<boolean> {
    try {
      const merchant = await Merchant.findByIdAndUpdate(
        merchantId,
        {
          isVerified: true,
          status: 'active'
        },
        { new: true }
      );

      if (!merchant) {
        throw NotFoundError('Merchant not found');
      }

      logger.info(`Merchant verified: ${merchant.businessName} (${merchant.email})`);
      
      return true;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error(`Error verifying merchant ${merchantId}:`, error);
      throw InternalError(`Failed to verify merchant: ${error.message}`);
    }
  }
}

export default new MerchantService();