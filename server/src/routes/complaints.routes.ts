import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createComplaint,
  getMyComplaints,
  getComplaintById,
  trackComplaintByTrackingId,
} from '../controllers/complaints.controller.js';
import {
  createProgressUpdate,
  getProgressUpdates,
  createInspection,
  getInspections,
  registerEvidence,
  getEvidence,
  submitResolution,
  verifyResolution,
  reopenComplaint,
} from '../controllers/officialWorkflow.controller.js';
import { UserRestrictionType } from '@prisma/client';
import {
  getComplaintMessages,
  sendComplaintMessage,
} from '../controllers/complaintMessages.controller.js';
import { authenticateUser, optionalAuthenticateUser } from '../middleware/auth.middleware.js';
import { requireNoRestriction } from '../middleware/restriction.middleware.js';
import { commentCreateLimiter } from '../lib/rateLimiters.js';

const router = Router();

// Rate limiter for lodging complaints (prevent spam)
const createComplaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: process.env.NODE_ENV === 'test' ? 1000 : 30, // 30 complaints per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many complaints lodged from this IP. Please wait before lodging another.',
    },
  },
});

// Rate limiter for public tracking queries (prevent brute force enumeration)
const trackLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 mins
  max: process.env.NODE_ENV === 'test' ? 1000 : 60, // 60 queries per 5 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many tracking requests. Please try again shortly.',
    },
  },
});

// Public tracking endpoint (strictly privacy-safe, no citizen PII)
router.get('/track/:trackingId', trackLimiter, optionalAuthenticateUser, trackComplaintByTrackingId);

// Authenticated citizen complaint filing & listing
router.post(
  '/',
  authenticateUser,
  createComplaintLimiter,
  requireNoRestriction(UserRestrictionType.SUBMISSION_RESTRICTED),
  createComplaint
);
router.get('/my', authenticateUser, getMyComplaints);
router.get('/:id', authenticateUser, getComplaintById);

// Module 7 Official Progress & Inspection Routes
router.post('/:id/progress', authenticateUser, createProgressUpdate);
router.get('/:id/progress', optionalAuthenticateUser, getProgressUpdates);
router.post('/:id/inspections', authenticateUser, createInspection);
router.get('/:id/inspections', optionalAuthenticateUser, getInspections);

// Module 7 Evidence Management Routes
router.post('/:id/evidence', authenticateUser, registerEvidence);
router.get('/:id/evidence', optionalAuthenticateUser, getEvidence);

// Module 7 Resolution & Citizen Verification Routes
router.post('/:id/resolution', authenticateUser, submitResolution);
router.post('/:id/verify-resolution', authenticateUser, verifyResolution);
router.post('/:id/reopen', authenticateUser, reopenComplaint);

// Module 9 Citizen-Official Communication Routes
router.get('/:id/messages', authenticateUser, getComplaintMessages);
router.post(
  '/:id/messages',
  authenticateUser,
  commentCreateLimiter,
  requireNoRestriction(UserRestrictionType.COMMENTING_RESTRICTED),
  sendComplaintMessage
);

export default router;

