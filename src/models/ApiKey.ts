import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

export interface IApiKey extends Document {
  merchantId: mongoose.Types.ObjectId;
  keyId: string; // "ak_..."
  keyHash: string; // Hash de la clé secrète
  keyPrefix: string; // "sk_live_" ou "sk_test_"
  name: string; // "Production API", "Test Key"
  isActive: boolean;
  lastUsed?: Date;
  usageCount: number;
  createdAt: Date;
  expiresAt?: Date;
  
  // Methods
  generateKey(): Promise<string>;
  verifyKey(key: string): Promise<boolean>;
}

const ApiKeySchema: Schema = new Schema(
  {
    merchantId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Merchant', 
      required: true 
    },
    keyId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true
    },
    keyHash: { 
      type: String, 
      required: true 
    },
    keyPrefix: { 
      type: String, 
      required: true,
      enum: ['sk_live_', 'sk_test_']
    },
    name: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 50
    },
    isActive: { 
      type: Boolean, 
      default: true 
    },
    lastUsed: { 
      type: Date 
    },
    usageCount: { 
      type: Number, 
      default: 0 
    },
    expiresAt: { 
      type: Date 
    }
  },
  { 
    timestamps: true 
  }
);

// Méthodes statiques pour générer des clés API
ApiKeySchema.statics.generateApiKey = function(environment: 'live' | 'test' = 'test'): { keyId: string, fullKey: string } {
  const keyId = `ak_${crypto.randomBytes(16).toString('hex')}`;
  const secret = crypto.randomBytes(24).toString('hex');
  const prefix = environment === 'live' ? 'sk_live_' : 'sk_test_';
  const fullKey = `${prefix}${secret}`;
  
  return { keyId, fullKey };
};

// Méthode pour hasher une clé
ApiKeySchema.statics.hashKey = async function(key: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(key, saltRounds);
};

// Méthode d'instance pour vérifier une clé
ApiKeySchema.methods.verifyKey = async function(key: string): Promise<boolean> {
  return await bcrypt.compare(key, this.keyHash);
};

// Index pour optimiser les requêtes
ApiKeySchema.index({ merchantId: 1 });
ApiKeySchema.index({ keyId: 1 });
ApiKeySchema.index({ keyHash: 1 });
ApiKeySchema.index({ isActive: 1 });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);