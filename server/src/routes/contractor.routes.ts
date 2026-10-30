import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticateUser, requireRoles } from '../middleware/auth.middleware.js';
import {
  getContractorDashboard,
  getContractorProfile,
  updateContractorProfile,
  getMyBids,
  getMyBidById,
  withdrawBid,
  getAwardedContracts,
  getWorkOrderById,
  submitWorkStart,
  submitProgressUpdate,
  claimMilestone,
  getContractorDefects,
  rectifyDefect,
} from '../controllers/contractor.controller.js';

const contractorRouter = Router();

// All routes require authentication
contractorRouter.use(authenticateUser);

// Dashboard & Profile
contractorRouter.get('/dashboard', requireRoles(UserRole.CONTRACTOR), getContractorDashboard);
contractorRouter.get('/profile', requireRoles(UserRole.CONTRACTOR), getContractorProfile);
contractorRouter.put('/profile', requireRoles(UserRole.CONTRACTOR), updateContractorProfile);

// Bids management
contractorRouter.get('/bids', requireRoles(UserRole.CONTRACTOR), getMyBids);
contractorRouter.get('/bids/:id', getMyBidById); // Ownership checked in controller
contractorRouter.post('/bids/:id/withdraw', requireRoles(UserRole.CONTRACTOR), withdrawBid);

// Contracts & Work Orders
contractorRouter.get('/work-orders', requireRoles(UserRole.CONTRACTOR), getAwardedContracts);
contractorRouter.get('/work-orders/:id', getWorkOrderById); // Ownership checked in controller

// Work Execution & Milestones
contractorRouter.post('/work-orders/:id/work-start', requireRoles(UserRole.CONTRACTOR), submitWorkStart);
contractorRouter.post('/work-orders/:id/progress', requireRoles(UserRole.CONTRACTOR), submitProgressUpdate);
contractorRouter.post('/work-orders/:id/milestones/:milestoneId/claim', requireRoles(UserRole.CONTRACTOR), claimMilestone);

// Defect & Warranty Tracking
contractorRouter.get('/defects', requireRoles(UserRole.CONTRACTOR), getContractorDefects);
contractorRouter.post('/defects/:id/rectify', requireRoles(UserRole.CONTRACTOR), rectifyDefect);

export default contractorRouter;
