import { Router } from 'express';
import { getDepartments, getCategories, getSystemStats } from '../controllers/meta.controller.js';

const router = Router();

router.get('/departments', getDepartments);
router.get('/categories', getCategories);
router.get('/stats', getSystemStats);

export default router;
