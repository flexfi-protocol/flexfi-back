import mongoose from 'mongoose';
import Notification, { NotificationType, INotification, INotificationData } from '../models/Notification';
import { EventType, EventData, eventEmitter, eventToNotificationMap } from '../utils/eventEmitter';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';
import { User } from '../models/User';
import brevoService from './brevoService';

/**
 * Creates a new notification
 * @param userId User ID to whom the notification belongs
 * @param type Type of notification
 * @param message Message content of the notification
 * @param data Optional additional data for the notification
 * @returns The created notification
 */
export const createNotification = async (
  userId: string, 
  type: NotificationType, 
  message: string, 
  data?: INotificationData
): Promise<INotification> => {
  try {
    const notification = new Notification({
      userId: new mongoose.Types.ObjectId(userId),
      type,
      message,
      data,
      read: false
    });
    
    return await notification.save();
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw new AppError('Failed to create notification', 500);
  }
};

/**
 * Gets all notifications for a user
 * @param userId User ID to get notifications for
 * @param limit Maximum number of notifications to return
 * @param offset Number of notifications to skip (for pagination)
 * @param onlyUnread Whether to only fetch unread notifications
 * @returns Array of notifications
 */
export const getUserNotifications = async (
  userId: string,
  limit: number = 20,
  offset: number = 0,
  onlyUnread: boolean = false
): Promise<{ notifications: INotification[], total: number }> => {
  try {
    const query: any = { userId: new mongoose.Types.ObjectId(userId) };
    
    if (onlyUnread) {
      query.read = false;
    }
    
    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      Notification.countDocuments(query)
    ]);
    
    return { notifications, total };
  } catch (error) {
    logger.error('Error getting user notifications:', error);
    throw new AppError('Failed to get notifications', 500);
  }
};

/**
 * Marks a notification as read
 * @param notificationId ID of the notification to mark as read
 * @param userId User ID to verify ownership
 * @returns The updated notification
 */
export const markNotificationAsRead = async (
  notificationId: string,
  userId: string
): Promise<INotification | null> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { 
        _id: notificationId, 
        userId: new mongoose.Types.ObjectId(userId) 
      },
      { read: true },
      { new: true }
    );
    
    if (!notification) {
      throw new AppError('Notification not found', 404);
    }
    
    return notification;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Error marking notification as read:', error);
    throw new AppError('Failed to update notification', 500);
  }
};

/**
 * Marks all notifications for a user as read
 * @param userId User ID to mark all notifications as read
 * @returns Number of notifications marked as read
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<number> => {
  try {
    const result = await Notification.updateMany(
      { 
        userId: new mongoose.Types.ObjectId(userId),
        read: false 
      },
      { read: true }
    );
    
    return result.modifiedCount;
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    throw new AppError('Failed to update notifications', 500);
  }
};

/**
 * Process event and create appropriate notification if needed
 * @param eventData The event data to process
 */
const processEvent = async (eventData: EventData): Promise<void> => {
  const { userId, type, payload } = eventData;
  
  try {
    // Check if this event type maps directly to a notification type
    let notificationType = eventToNotificationMap[type];
    
    // For events that require additional logic to determine notification type
    if (notificationType === null) {
      switch (type) {
        case EventType.DELEGATION_UPDATED:
          if (payload.approved) {
            notificationType = NotificationType.DELEGATION_APPROVED;
          } else if (payload.expired) {
            notificationType = NotificationType.DELEGATION_EXPIRED;
          }
          break;
          
        case EventType.KYC_STATUS_CHANGED:
          if (payload.status === 'approved') {
            notificationType = NotificationType.KYC_APPROVED;
          } else if (payload.status === 'rejected') {
            notificationType = NotificationType.KYC_REJECTED;
          }
          break;
          
        case EventType.CARD_STATUS_CHANGED:
          if (payload.status === 'approved') {
            notificationType = NotificationType.CARD_APPROVED;
          } else if (payload.status === 'rejected') {
            notificationType = NotificationType.CARD_REJECTED;
          } else if (payload.status === 'activated') {
            notificationType = NotificationType.CARD_ACTIVATED;
          }
          break;
          
        case EventType.TRANSACTION_STATUS_CHANGED:
          if (payload.status === 'pending') {
            notificationType = NotificationType.TRANSACTION_PENDING;
          } else if (payload.status === 'completed') {
            notificationType = NotificationType.TRANSACTION_COMPLETED;
          } else if (payload.status === 'failed') {
            notificationType = NotificationType.TRANSACTION_FAILED;
          }
          break;
          
        case EventType.PAYMENT_STATUS_CHANGED:
          if (payload.status === 'success') {
            notificationType = NotificationType.PAYMENT_SUCCESS;
          } else if (payload.status === 'failed') {
            notificationType = NotificationType.PAYMENT_FAILED;
          } else if (payload.status === 'late') {
            notificationType = NotificationType.PAYMENT_LATE;
          }
          break;
          
        case EventType.BALANCE_CHANGED:
          // Only notify if balance is below threshold
          if (payload.balance < payload.threshold) {
            notificationType = NotificationType.LOW_BALANCE;
          }
          break;
          
        default:
          break;
      }
    }
    
    // If we have a notification type, create the notification
    if (notificationType) {
      // Generate message based on notification type
      const message = generateNotificationMessage(notificationType, payload);
      
      await createNotification(userId, notificationType, message, payload);
    }
  } catch (error) {
    logger.error(`Error processing event ${type} for user ${userId}:`, error);
  }
};

/**
 * Generate a human-readable message for a notification
 * @param type Notification type
 * @param data Additional data for the notification
 * @returns A formatted message string
 */
const generateNotificationMessage = (type: NotificationType, data: any = {}): string => {
  switch (type) {
    // Authentication notifications
    case NotificationType.ACCOUNT_CREATED:
      return 'Your account has been successfully created. Welcome to FlexFi!';
    case NotificationType.LOGIN_NEW_DEVICE:
      return `New login detected from ${data.device || 'a new device'} at ${data.location || 'unknown location'}.`;
    case NotificationType.PASSWORD_CHANGED:
      return 'Your password has been successfully changed.';
    
    // Wallet notifications
    case NotificationType.WALLET_CREATED:
      return 'Your new wallet has been successfully created.';
    case NotificationType.WALLET_CONNECTED:
      return 'Your wallet has been successfully connected to your account.';
    case NotificationType.DELEGATION_APPROVED:
      return 'Your token delegation request has been approved.';
    case NotificationType.DELEGATION_EXPIRED:
      return 'Your token delegation has expired. Please renew it to continue using FlexFi services.';
    case NotificationType.LOW_BALANCE:
      return `Your wallet balance (${data.balance || '0'} ${data.symbol || 'SOL'}) is below the recommended minimum.`;
    case NotificationType.TRANSACTION_CONFIRMED:
      return `Transaction of ${data.amount || ''} ${data.symbol || 'SOL'} has been confirmed.`;
    
    // KYC notifications
    case NotificationType.KYC_SUBMITTED:
      return 'Your KYC verification has been submitted and is being processed.';
    case NotificationType.KYC_APPROVED:
      return 'Your KYC verification has been approved. You now have full access to FlexFi services.';
    case NotificationType.KYC_REJECTED:
      return `Your KYC verification was not approved. Reason: ${data.reason || 'Please contact support for more information.'}`; 
    case NotificationType.KYC_EXPIRING:
      return `Your KYC verification will expire in ${data.daysRemaining || 'a few'} days. Please update your documents.`;
    
    // Card notifications
    case NotificationType.CARD_SELECTED:
      return `You have selected the ${data.cardType || 'virtual'} card. Your application is being processed.`;
    case NotificationType.CARD_APPROVED:
      return `Your ${data.cardType || 'virtual'} card has been approved!`;
    case NotificationType.CARD_REJECTED:
      return `Your ${data.cardType || 'card'} application was not approved. ${data.reason || 'Please contact support for more information.'}`;
    case NotificationType.CARD_ACTIVATED:
      return `Your ${data.cardType || 'virtual'} card has been successfully activated.`;
    case NotificationType.CARD_LIMIT_CHANGED:
      return `Your card limit has been updated to ${data.newLimit || ''}.`;
    
    // Transaction notifications
    case NotificationType.TRANSACTION_PENDING:
      return `Your transaction of ${data.amount || ''} ${data.symbol || 'SOL'} is being processed.`;
    case NotificationType.TRANSACTION_COMPLETED:
      return `Your transaction of ${data.amount || ''} ${data.symbol || 'SOL'} has been completed successfully.`;
    case NotificationType.TRANSACTION_FAILED:
      return `Your transaction of ${data.amount || ''} ${data.symbol || 'SOL'} has failed. Reason: ${data.reason || 'Unknown error'}`;
    
    // Repayment notifications
    case NotificationType.PAYMENT_UPCOMING:
      return `Payment of ${data.amount || ''} due on ${data.dueDate || 'soon'}.`;
    case NotificationType.PAYMENT_SUCCESS:
      return `Your payment of ${data.amount || ''} was successful.`;
    case NotificationType.PAYMENT_FAILED:
      return `Your payment of ${data.amount || ''} has failed. Reason: ${data.reason || 'Unknown error'}`;
    case NotificationType.PAYMENT_LATE:
      return `Your payment of ${data.amount || ''} is overdue. Please make your payment as soon as possible to avoid additional fees.`;
    
    default:
      return 'You have a new notification.';
  }
};

// Set up event listeners
eventEmitter.on('*', processEvent);

// Export both direct API and the event processor
export default {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  processEvent,
  // Send email using Brevo service
  async sendEmail(emailData: {
    to: string;
    subject: string;
    template: {
      name: string;
      data: Record<string, any>;
    };
  }): Promise<void> {
    try {
      await brevoService.sendTemplateEmail(
        emailData.to,
        emailData.subject,
        emailData.template.name,
        emailData.template.data
      );
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  },
  // Add a method to send Zealy connection email notification
  async sendZealyConnectionEmail(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.email) {
        throw new Error("User not found or has no email");
      }

      // Check if user already has a Zealy account connected
      if (user.zealy_id) {
        logger.debug(`User ${userId} already has a Zealy account connected, skipping email`);
        return;
      }

      // Prepare email data
      const emailData = {
        to: user.email,
        subject: "Earn more FlexPoints with Zealy!",
        template: {
          name: "zealy-connection",
          data: {
            firstName: user.firstName || "FlexFi User",
            zealyConnectUrl: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/zealy/connect`,
            currentPoints: user.flexpoints_total || 0
          }
        }
      };

      // Send the email
      await this.sendEmail(emailData);
      logger.info(`Zealy connection email sent to user ${userId}`);
    } catch (error) {
      logger.error(`Failed to send Zealy connection email to user ${userId}:`, error);
      throw error;
    }
  }
}; 