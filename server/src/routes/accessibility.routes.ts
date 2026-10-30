import { Router } from 'express';
import {
  authenticateUser,
  optionalAuthenticateUser,
} from '../middleware/auth.middleware.js';
import {
  getSupportedLanguages,
  getUserAccessibilityPreferences,
  updateUserAccessibilityPreferences,
} from '../controllers/accessibility.controller.js';

const router = Router();

// Public language metadata directory
router.get('/languages', getSupportedLanguages);

// Accessibility and language preferences (optional auth for read, required auth for write)
router.get('/preferences', optionalAuthenticateUser, getUserAccessibilityPreferences);
router.put('/preferences', authenticateUser, updateUserAccessibilityPreferences);

export default router;
