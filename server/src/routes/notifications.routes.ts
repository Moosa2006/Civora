import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.middleware.js';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserPreferences,
  updateUserPreferences,
} from '../controllers/notifications.controller.js';

const router = Router();

// All notification routes require authenticated session
router.use(authenticateUser);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.patch('/:id/read', markNotificationAsRead);
router.post('/mark-all-read', markAllNotificationsAsRead);
router.get('/preferences', getUserPreferences);
router.put('/preferences', updateUserPreferences);

export default router;
