import mongoose, { Document, Schema } from 'mongoose';

export interface IMerchant extends Document {
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
  isVerified: boolean;
  verificationData?: any;
  status: 'pending' | 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

const MerchantSchema = new Schema<IMerchant>(
  {
    businessName: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 100
    },
    email: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      validate: {
        validator: function(email: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
        message: 'Invalid email format'
      }
    },
    country: { 
      type: String, 
      required: true, 
      enum: ['FR', 'BR', 'AR'] 
    },
    registrationNumber: { 
      type: String, 
      required: true,
      trim: true
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true }
    },
    contactPerson: { 
      type: String, 
      required: true,
      trim: true
    },
    publicKey: { 
      type: String, 
      required: true,
      validate: {
        validator: function(v: string) {
          return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v);
        },
        message: 'Invalid Solana public key format'
      }
    },
    isVerified: { 
      type: Boolean, 
      default: false 
    },
    verificationData: { 
      type: Schema.Types.Mixed 
    },
    status: { 
      type: String, 
      enum: ['pending', 'active', 'suspended'],
      default: 'pending'
    }
  },
  { 
    timestamps: true, // ✅ Ceci gère automatiquement createdAt/updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index pour optimiser les requêtes
MerchantSchema.index({ email: 1 });
MerchantSchema.index({ publicKey: 1 });
MerchantSchema.index({ status: 1 });

export const Merchant = mongoose.model<IMerchant>('Merchant', MerchantSchema);