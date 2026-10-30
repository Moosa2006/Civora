import { Router } from 'express';
import {
  getMapComplaints,
  getNearbyComplaints,
  getGeographicHotspots,
  getOfficialGeoSummary,
  getLocalities,
  geocodeAddress,
  updateComplaintLocation,
} from '../controllers/geo.controller.js';
import {
  authenticateUser,
  optionalAuthenticateUser,
  requireRoles,
} from '../middleware/auth.middleware.js';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * 1. Public map viewport complaints
 * GET /api/geo/complaints
 */
router.get('/complaints', optionalAuthenticateUser, getMapComplaints);

/**
 * 2. Nearby complaints discovery
 * GET /api/geo/nearby
 */
router.get('/nearby', optionalAuthenticateUser, getNearbyComplaints);

/**
 * 3. Geographic hotspots and clustering
 * GET /api/geo/hotspots
 */
router.get('/hotspots', getGeographicHotspots);

/**
 * 4. Localities directory and autocomplete
 * GET /api/geo/localities
 */
router.get('/localities', getLocalities);

/**
 * 5. Geocode lookup
 * GET /api/geo/geocode
 */
router.get('/geocode', geocodeAddress);

/**
 * 6. Official & Admin department geographic dashboard
 * GET /api/geo/official-summary
 */
router.get(
  '/official-summary',
  authenticateUser,
  requireRoles(UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL),
  getOfficialGeoSummary
);

/**
 * 7. Update or refine complaint location
 * PATCH /api/geo/complaints/:id/location
 */
router.patch('/complaints/:id/location', authenticateUser, updateComplaintLocation);

export default router;
