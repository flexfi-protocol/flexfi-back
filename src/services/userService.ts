import { IUser, User, UserDocument } from "../models/User";

export class UserService {
  // Récupérer un utilisateur par ID
  async getUserById(id: string): Promise<UserDocument | null> {
    try {
      return await User.findById(id);
    } catch (error) {
      throw error;
    }
  }

  // Récupérer un utilisateur par email
  async getUserByEmail(email: string): Promise<UserDocument | null> {
    try {
      return await User.findOne({ email });
    } catch (error) {
      throw error;
    }
  }

  // Mettre à jour les informations d'un utilisateur
  async updateUser(
    id: string,
    updates: Partial<IUser>
  ): Promise<UserDocument | null> {
    try {
      return await User.findByIdAndUpdate(id, updates, { new: true });
    } catch (error) {
      throw error;
    }
  }

  // Ajouter un wallet à un utilisateur
  async addWalletToUser(
    userId: string,
    publicKey: string,
    type: "connected" | "created"
  ): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        {
          $push: {
            wallets: {
              publicKey,
              type,
              hasDelegation: false,
            },
          },
        },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Mettre à jour le statut de délégation d'un wallet
  async updateWalletDelegation(
    userId: string,
    publicKey: string,
    hasDelegation: boolean,
    delegationExpiry?: Date
  ): Promise<IUser | null> {
    try {
      return await User.findOneAndUpdate(
        {
          _id: userId,
          "wallets.publicKey": publicKey,
        },
        {
          $set: {
            "wallets.$.hasDelegation": hasDelegation,
            "wallets.$.delegationExpiry": delegationExpiry,
          },
        },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Mettre à jour le statut KYC d'un utilisateur
  async updateKYCStatus(
    userId: string,
    status: "none" | "pending" | "approved" | "rejected",
    kycId?: string
  ): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        {
          kycStatus: status,
          kycId,
        },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }

  // Mettre à jour la carte sélectionnée par l'utilisateur
  async updateSelectedCard(
    userId: string,
    cardType: "standard" | "gold" | "platinum"
  ): Promise<IUser | null> {
    try {
      return await User.findByIdAndUpdate(
        userId,
        { selectedCard: cardType },
        { new: true }
      );
    } catch (error) {
      throw error;
    }
  }
}

export default new UserService();
