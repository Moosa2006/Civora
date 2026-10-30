import { Router } from 'express';
import {
  getPublicMetrics,
  getPublicTrends,
  getStatusDistribution,
  getDepartmentAccountability,
  getPublicComplaints,
} from '../controllers/transparency.controller.js';

const router = Router();

// Public transparency analytics endpoints
router.get('/metrics', getPublicMetrics);
router.get('/trends', getPublicTrends);
router.get('/status-distribution', getStatusDistribution);
router.get('/departments', getDepartmentAccountability);
router.get('/complaints', getPublicComplaints);

export default router;
