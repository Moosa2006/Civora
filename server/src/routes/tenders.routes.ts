import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, optionalAuthenticateUser, requireRoles } from '../middleware/auth.middleware.js';
import {
  getTenders,
  getTenderById,
  createTender,
  updateTender,
  publishTender,
  submitBid,
  getTenderBids,
  evaluateBid,
  awardTender,
} from '../controllers/tenders.controller.js';

const tendersRouter = Router();

// Public / Contractor browsing
tendersRouter.get('/', optionalAuthenticateUser, getTenders);
tendersRouter.get('/:id', optionalAuthenticateUser, getTenderById);

// Official / Admin tender management
tendersRouter.post(
  '/',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  createTender
);

tendersRouter.put(
  '/:id',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  updateTender
);

tendersRouter.post(
  '/:id/publish',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  publishTender
);

// Contractor bidding
tendersRouter.post(
  '/:id/bids',
  authenticateUser,
  requireRoles(UserRole.CONTRACTOR),
  submitBid
);

// Official bid inspection, evaluation, and contract award
tendersRouter.get(
  '/:id/bids',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  getTenderBids
);

tendersRouter.post(
  '/:id/bids/:bidId/evaluate',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  evaluateBid
);

tendersRouter.post(
  '/:id/award',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  awardTender
);

export default tendersRouter;
