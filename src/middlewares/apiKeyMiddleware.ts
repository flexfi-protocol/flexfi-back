import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import merchantService from '../services/merchantService';
import logger from '../utils/logger';

// Étendre les types Express pour inclure les propriétés merchant et apiKey
declare global {
  namespace Express {
    interface Request {
      merchant?: any;
      apiKey?: any;
    }
  }
}

/**
 * Middleware pour valider les clés API FlexFi
 */
export const validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Récupérer la clé API depuis le header
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({ 
        error: 'API key required',
        message: 'Please provide your API key in the X-API-Key header'
      });
      return;
    }
    
    // Vérifier le format de la clé API
    if (!apiKey.match(/^sk_(live|test)_[a-zA-Z0-9]{48}$/)) {
      res.status(401).json({ 
        error: 'Invalid API key format',
        message: 'API key must be in format: sk_live_xxx or sk_test_xxx'
      });
      return;
    }
    
    // Vérifier la clé API en base de données
    const verification = await merchantService.verifyApiKey(apiKey);
    
    if (!verification) {
      res.status(401).json({ 
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been revoked'
      });
      return;
    }

    const { apiKey: apiKeyRecord, merchant } = verification;

    // Vérifier que le marchand est actif
    if (merchant.status !== 'active') {
      res.status(403).json({ 
        error: 'Merchant account inactive',
        message: `Merchant account status is: ${merchant.status}`
      });
      return;
    }

    // Attacher les informations à la requête
    req.merchant = merchant;
    req.apiKey = apiKeyRecord;
    
    logger.debug(`API request from merchant: ${merchant.businessName} (${merchant._id})`);
    
    next();
  } catch (error: any) {
    logger.error('API key validation error:', error);
    res.status(500).json({ 
      error: 'API key validation failed',
      message: 'Internal server error during API key validation'
    });
  }
};

/**
 * Rate limiting par clé API
 */
export const rateLimitByApiKey = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requêtes par fenêtre par clé API
  keyGenerator: (req: Request) => {
    // Utiliser l'ID de la clé API pour le rate limiting
    return req.apiKey?.keyId || req.ip;
  },
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests from this API key. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for API key: ${req.apiKey?.keyId || 'unknown'} from IP: ${req.ip}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests from this API key. Please try again later.',
      retryAfter: '15 minutes'
    });
  }
});

/**
 * Rate limiting plus strict pour les environnements de test
 */
export const rateLimitTestKeys = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par fenêtre pour les clés de test
  keyGenerator: (req: Request) => req.apiKey?.keyId || req.ip,
  skip: (req: Request) => {
    // Appliquer seulement aux clés de test
    return !req.apiKey?.keyPrefix.includes('test');
  },
  message: {
    error: 'Test API rate limit exceeded',
    message: 'Test API keys are limited to 100 requests per 15 minutes.',
    retryAfter: '15 minutes'
  }
});

/**
 * Middleware pour logger les requêtes API
 */
export const logApiRequest = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Logger la requête entrante
  logger.info('API Request', {
    method: req.method,
    path: req.path,
    merchantId: req.merchant?._id,
    apiKeyId: req.apiKey?.keyId,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  // Capturer la réponse
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    logger.info('API Response', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      merchantId: req.merchant?._id,
      apiKeyId: req.apiKey?.keyId
    });

    return originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware pour valider l'environnement de la clé API
 */
export const validateApiEnvironment = (allowedEnvironments: ('live' | 'test')[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const keyEnvironment = req.apiKey?.keyPrefix.includes('live') ? 'live' : 'test';
    
    if (!allowedEnvironments.includes(keyEnvironment)) {
      res.status(403).json({
        error: 'Invalid API key environment',
        message: `This endpoint requires a ${allowedEnvironments.join(' or ')} API key`
      });
      return;
    }
    
    next();
  };
};

/**
 * Middleware pour vérifier les permissions spécifiques
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Pour l'instant, tous les marchands actifs ont toutes les permissions
    // Dans le futur, on peut ajouter un système de permissions plus granulaire
    
    if (req.merchant?.status !== 'active') {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires permission: ${permission}`
      });
      return;
    }
    
    next();
  };
};