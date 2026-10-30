import { Router } from 'express';
import {
  getPublicProjects,
  getPublicProjectById,
} from '../controllers/projects.controller.js';

const router = Router();

// Public civic projects monitoring endpoints
router.get('/', getPublicProjects);
router.get('/:id', getPublicProjectById);

export default router;
