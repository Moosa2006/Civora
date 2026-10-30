import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { UserRole } from '@prisma/client';
import {
  register,
  registerContractor,
  getContractorApplicationStatus,
  login,
  getCurrentUser,
  logout,
  adminCheck,
} from '../controllers/auth.controller.js';
import { authenticateUser, requireRoles } from '../middleware/auth.middleware.js';

const router = Router();

// Rate limiter for authentication endpoints (prevent brute force, relaxed in test/dev)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 100, // relaxed for automated testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});

// Public authentication & registration routes
router.post('/register', authLimiter, register);
router.post('/register-contractor', authLimiter, registerContractor);
router.get('/contractor-application-status', getContractorApplicationStatus);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

// Protected routes (Require active authentication)
router.get('/me', authenticateUser, getCurrentUser);

// Role-protected test route (Requires ADMIN role)
router.get('/admin-check', authenticateUser, requireRoles(UserRole.ADMIN), adminCheck);

export default router;
