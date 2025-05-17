import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import notificationController from '../controllers/notificationController';

const router = Router();

// All notification routes require authentication
router.use(authMiddleware);

// Get notifications
router.get('/', notificationController.getNotifications);

// Get unread notification count
router.get('/unread/count', notificationController.getUnreadCount);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead);

// Create Zealy connection notification
router.post('/create-zealy-notification', notificationController.createZealyNotification);

export default router; 