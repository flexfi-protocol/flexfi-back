import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import merchantService from '../services/merchantService';
import { authenticate } from '../middlewares/authMiddleware';
import { AppError, BadRequestError } from '../utils/AppError';
import logger from '../utils/logger';

const router = Router();

/**
 * Validation rules pour l'inscription marchand
 */
const merchantRegistrationValidation = [
  body('businessName')
    .notEmpty()
    .withMessage('Business name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Business name must be between 2 and 100 characters'),
    
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
    
  body('country')
    .isIn(['FR', 'BR', 'AR'])
    .withMessage('Country must be FR, BR, or AR'),
    
  body('registrationNumber')
    .notEmpty()
    .withMessage('Registration number is required')
    .isLength({ min: 5, max: 20 })
    .withMessage('Registration number must be between 5 and 20 characters'),
    
  body('address.street')
    .notEmpty()
    .withMessage('Street address is required'),
    
  body('address.city')
    .notEmpty()
    .withMessage('City is required'),
    
  body('address.postalCode')
    .notEmpty()
    .withMessage('Postal code is required'),
    
  body('address.country')
    .notEmpty()
    .withMessage('Country is required'),
    
  body('contactPerson')
    .trim()
    .notEmpty()
    .withMessage('Contact person is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Contact person must be between 2 and 50 characters'),
    
  body('publicKey')
    .notEmpty()
    .withMessage('Wallet public key is required')
    .matches(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    .withMessage('Invalid Solana public key format')
];

/**
 * Validation rules pour la génération de clé API
 */
const apiKeyValidation = [
  body('name')
    .notEmpty()
    .withMessage('API key name is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('API key name must be between 1 and 50 characters'),
    
  body('environment')
    .isIn(['live', 'test'])
    .withMessage('Environment must be either live or test')
];

/**
 * Middleware pour gérer les erreurs de validation
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Please check your input data',
      details: errors.array()
    });
  }
  next();
};

/**
 * POST /api/merchants/register
 * Inscription d'un nouveau marchand
 */
router.post('/register', merchantRegistrationValidation, handleValidationErrors, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const merchantData = req.body;
    
    logger.info(`New merchant registration attempt: ${merchantData.businessName} (${merchantData.email})`);
    
    const merchant = await merchantService.registerMerchant(merchantData);
    
    // Ne pas exposer toutes les données sensibles
    const responseData = {
      id: merchant._id,
      businessName: merchant.businessName,
      email: merchant.email,
      country: merchant.country,
      status: merchant.status,
      isVerified: merchant.isVerified,
      createdAt: merchant.createdAt
    };
    
    res.status(201).json({
      success: true,
      data: responseData,
      message: 'Merchant registered successfully. Verification pending.'
    });
    
    } catch (error: any) {
      // Gérer ConflictError directement
      if (error.name === 'ConflictError' || error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      }
      next(error);
    }
});

/**
 * GET /api/merchants/me
 * Récupérer les informations du marchand connecté
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Pour l'instant, on utilise l'auth existante
    // Plus tard, on utilisera le middleware API key
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Chercher le marchand associé à cet utilisateur
    // Pour l'instant, on suppose qu'il faut d'abord s'inscrire comme marchand
    res.status(200).json({
      success: true,
      message: 'Merchant authentication will be implemented with API keys'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/merchants/me
 * Mettre à jour les informations du marchand
 */
router.put('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Implémenter la mise à jour des informations marchand
    res.status(200).json({
      success: true,
      message: 'Merchant update functionality coming soon'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/merchants/api-keys
 * Générer une nouvelle clé API
 */
router.post('/api-keys', apiKeyValidation, handleValidationErrors, authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, environment } = req.body;
    const userId = (req.user as any)?._id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Pour l'instant, on retourne un message d'information
    // L'implémentation complète nécessite de lier User et Merchant
    res.status(200).json({
      success: true,
      message: 'API key generation will be implemented after merchant registration flow'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/merchants/api-keys
 * Lister les clés API du marchand
 */
router.get('/api-keys', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Implémenter la liste des clés API
    res.status(200).json({
      success: true,
      data: [],
      message: 'API key listing will be implemented'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/merchants/api-keys/:keyId
 * Révoquer une clé API
 */
router.delete('/api-keys/:keyId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keyId } = req.params;
    
    // TODO: Implémenter la révocation de clé API
    res.status(200).json({
      success: true,
      message: `API key ${keyId} revocation will be implemented`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/merchants/dashboard
 * Récupérer les statistiques du marchand
 */
router.get('/dashboard', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Implémenter les statistiques dashboard
    res.status(200).json({
      success: true,
      data: {
        totalPayments: 0,
        totalAmount: 0,
        successRate: 0,
        recentPayments: []
      },
      message: 'Dashboard data will be implemented'
    });
  } catch (error) {
    next(error);
  }
});

export default router;