import { Request, Response, NextFunction } from 'express';
import notificationService from '../services/notificationService';
import { NotificationService } from '../services/serviceInterfaces';
import { AppError } from '../utils/AppError';
import { getUserIdFromRequest } from '../utils/requestUtils';
import { User } from '../models/User';
import { NotificationType } from '../models/Notification';

// Cast imported service to interface
const notificationServiceInterface = notificationService as unknown as NotificationService;

/**
 * Get all notifications for a user
 * @route GET /api/notifications
 */
const getNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const onlyUnread = req.query.unread === 'true';
    
    const { notifications, total } = await notificationServiceInterface.getUserNotifications(
      userId,
      limit,
      offset,
      onlyUnread
    );
    
    res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + notifications.length < total
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count for a user
 * @route GET /api/notifications/unread-count
 */
const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }
    
    const { total } = await notificationServiceInterface.getUserNotifications(
      userId,
      0,
      0,
      true
    );
    
    res.status(200).json({
      success: true,
      data: { count: total }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a notification as read
 * @route PUT /api/notifications/:id/read
 */
const markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserIdFromRequest(req);
    const notificationId = req.params.id;
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }
    
    if (!notificationId) {
      return next(new AppError('Notification ID is required', 400));
    }
    
    const notification = await notificationServiceInterface.markNotificationAsRead(notificationId, userId);
    
    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read
 * @route PUT /api/notifications/read-all
 */
const markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }
    
    const count = await notificationServiceInterface.markAllNotificationsAsRead(userId);
    
    res.status(200).json({
      success: true,
      data: { count },
      message: `${count} notifications marked as read`
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a notification for Zealy connection
 * @route POST /api/notifications/create-zealy-notification
 */
const createZealyNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = getUserIdFromRequest(req);
    
    if (!userId) {
      return next(new AppError('User not authenticated', 401));
    }
    
    // Check if user already has a Zealy account connected
    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
    
    if (user.zealy_id) {
      return next(new AppError('User already has a Zealy account connected', 400));
    }
    
    // Create notification
    const notification = await notificationServiceInterface.createNotification(
      userId,
      NotificationType.TRANSACTION_PENDING, // Using an existing type as placeholder
      'Connect your Zealy account to merge your missions & gain XP. Your FlexPoints will increase accordingly.',
      {
        action: 'connect_zealy',
        url: '/api/zealy/connect'
      }
    );
    
    res.status(201).json({
      success: true,
      data: notification
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createZealyNotification
}; 