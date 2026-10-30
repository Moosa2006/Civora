import type { Request, Response, NextFunction } from 'express';
import { UserRole, ComplaintStatus, SlaStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { GeoService, BENGALURU_LOCALITIES } from '../lib/geoService.js';
import {
  mapViewportQuerySchema,
  nearbyQuerySchema,
  hotspotsQuerySchema,
  updateComplaintLocationSchema,
} from '../validation/geo.validation.js';

function isValidUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

/**
 * 1. GET /api/geo/complaints
 * Public map viewport query. Returns privacy-generalized complaints within bounds.
 */
export async function getMapComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = mapViewportQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid map viewport query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const {
      minLat,
      maxLat,
      minLng,
      maxLng,
      categoryId,
      status,
      priority,
      departmentId,
      search,
      locality,
      ward,
      startDate,
      endDate,
      limit,
    } = parseResult.data;

    // Check bounds span: reject excessive bounding box (> 5 degrees span)
    if (maxLat - minLat > 5 || maxLng - minLng > 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VIEWPORT_TOO_LARGE',
          message: 'The requested map bounding box is too large. Please zoom in to view complaints.',
        },
      });
    }

    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);

    // Build database where clause
    const where: Prisma.ComplaintWhereInput = {
      latitude: {
        gte: new Prisma.Decimal(minLat),
        lte: new Prisma.Decimal(maxLat),
      },
      longitude: {
        gte: new Prisma.Decimal(minLng),
        lte: new Prisma.Decimal(maxLng),
      },
    };

    // Public privacy boundary: ordinary citizens and unauthenticated guests only see public locations
    if (!isStaff) {
      where.isLocationPublic = true;
    }

    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (departmentId) where.assignedDepartmentId = departmentId;
    if (locality) where.locality = { contains: locality, mode: 'insensitive' };
    if (ward) where.ward = { contains: ward, mode: 'insensitive' };

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { trackingId: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { locality: { contains: term, mode: 'insensitive' } },
        { ward: { contains: term, mode: 'insensitive' } },
      ];
    }

    const complaints = await prisma.complaint.findMany({
      where,
      select: {
        id: true,
        trackingId: true,
        title: true,
        status: true,
        priority: true,
        locality: true,
        ward: true,
        latitude: true,
        longitude: true,
        isLocationPublic: true,
        createdAt: true,
        resolvedAt: true,
        category: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        assignedDepartment: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    // Generalize coordinates for public protection
    const markers = complaints.map((c) => {
      const rawLat = Number(c.latitude);
      const rawLng = Number(c.longitude);

      // Staff with explicit role sees raw coordinates for field operations;
      // public users see coordinates generalized to ~110m resolution
      const coords = isStaff
        ? { lat: rawLat, lng: rawLng }
        : GeoService.generalizeCoordinates(rawLat, rawLng, c.id);

      return {
        id: c.id,
        trackingId: c.trackingId,
        title: c.title,
        status: c.status,
        priority: c.priority,
        category: c.category,
        assignedDepartment: c.assignedDepartment,
        locality: c.locality,
        ward: c.ward,
        latitude: coords.lat,
        longitude: coords.lng,
        isGeneralized: !isStaff,
        createdAt: c.createdAt,
        resolvedAt: c.resolvedAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        count: markers.length,
        viewport: { minLat, maxLat, minLng, maxLng },
        markers,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 2. GET /api/geo/nearby
 * Discovers public complaints within a radius around a user-specified coordinate
 */
export async function getNearbyComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = nearbyQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid nearby query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { lat, lng, radiusKm, categoryId, status, priority, search, limit } = parseResult.data;

    // Approximate bounding box filter for candidate selection:
    // 1 deg latitude ≈ 111km; 1 deg longitude ≈ 111km * cos(lat)
    const latDelta = radiusKm / 111.0;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const lngDelta = radiusKm / (111.0 * Math.max(cosLat, 0.1));

    const isStaff =
      req.user &&
      (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);

    const where: Prisma.ComplaintWhereInput = {
      latitude: {
        gte: new Prisma.Decimal(lat - latDelta),
        lte: new Prisma.Decimal(lat + latDelta),
      },
      longitude: {
        gte: new Prisma.Decimal(lng - lngDelta),
        lte: new Prisma.Decimal(lng + lngDelta),
      },
    };

    if (!isStaff) {
      where.isLocationPublic = true;
    }

    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (priority) where.priority = priority;

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { trackingId: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { locality: { contains: term, mode: 'insensitive' } },
        { ward: { contains: term, mode: 'insensitive' } },
      ];
    }

    const candidates = await prisma.complaint.findMany({
      where,
      select: {
        id: true,
        trackingId: true,
        title: true,
        status: true,
        priority: true,
        locality: true,
        ward: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        category: {
          select: { id: true, code: true, name: true },
        },
        assignedDepartment: {
          select: { id: true, code: true, name: true },
        },
      },
      take: 200,
    });

    // Compute exact Haversine distance and sort
    const matched = candidates
      .map((c) => {
        const rawLat = Number(c.latitude);
        const rawLng = Number(c.longitude);
        const distanceKm = GeoService.haversineDistance(lat, lng, rawLat, rawLng);
        const coords = isStaff
          ? { lat: rawLat, lng: rawLng }
          : GeoService.generalizeCoordinates(rawLat, rawLng, c.id);

        return {
          id: c.id,
          trackingId: c.trackingId,
          title: c.title,
          status: c.status,
          priority: c.priority,
          locality: c.locality,
          ward: c.ward,
          category: c.category,
          assignedDepartment: c.assignedDepartment,
          latitude: coords.lat,
          longitude: coords.lng,
          distanceKm,
          createdAt: c.createdAt,
        };
      })
      .filter((item) => item.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return res.status(200).json({
      success: true,
      data: {
        origin: { lat, lng },
        radiusKm,
        count: matched.length,
        complaints: matched,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 3. GET /api/geo/hotspots
 * Aggregates complaints by ward or locality to reveal recurring problem areas
 */
export async function getGeographicHotspots(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = hotspotsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid hotspots query parameters.',
        },
      });
    }

    const { groupBy, categoryId, departmentId, status, startDate, endDate } = parseResult.data;

    const where: Prisma.ComplaintWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (departmentId) where.assignedDepartmentId = departmentId;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    // Retrieve active complaints with location and SLA
    const complaints = await prisma.complaint.findMany({
      where,
      select: {
        id: true,
        locality: true,
        ward: true,
        status: true,
        latitude: true,
        longitude: true,
        category: {
          select: { id: true, name: true, code: true },
        },
        sla: {
          select: { slaStatus: true, isResolutionOverdue: true, isResponseOverdue: true },
        },
      },
    });

    // Grouping
    const groups = new Map<
      string,
      {
        name: string;
        total: number;
        active: number;
        resolved: number;
        overdue: number;
        lats: number[];
        lngs: number[];
        categoryCounts: Map<string, { count: number; name: string }>;
      }
    >();

    for (const c of complaints) {
      const key = groupBy === 'ward' ? (c.ward?.trim() || 'Unassigned Ward') : (c.locality.trim() || 'General Locality');

      if (!groups.has(key)) {
        groups.set(key, {
          name: key,
          total: 0,
          active: 0,
          resolved: 0,
          overdue: 0,
          lats: [],
          lngs: [],
          categoryCounts: new Map(),
        });
      }

      const g = groups.get(key)!;
      g.total += 1;

      const isResolved =
        c.status === ComplaintStatus.RESOLVED ||
        c.status === ComplaintStatus.VERIFIED ||
        c.status === ComplaintStatus.CLOSED;

      if (isResolved) {
        g.resolved += 1;
      } else if (c.status !== ComplaintStatus.REJECTED) {
        g.active += 1;
      }

      // Check overdue SLA
      if (
        c.sla &&
        (c.sla.slaStatus === SlaStatus.RESPONSE_OVERDUE ||
          c.sla.slaStatus === SlaStatus.RESOLUTION_OVERDUE ||
          c.sla.slaStatus === SlaStatus.BREACHED ||
          c.sla.isResolutionOverdue ||
          c.sla.isResponseOverdue)
      ) {
        g.overdue += 1;
      }

      // Record coordinates for centroid calculation
      if (c.latitude && c.longitude) {
        g.lats.push(Number(c.latitude));
        g.lngs.push(Number(c.longitude));
      }

      // Category breakdown
      const catKey = c.category.code;
      if (!g.categoryCounts.has(catKey)) {
        g.categoryCounts.set(catKey, { count: 0, name: c.category.name });
      }
      g.categoryCounts.get(catKey)!.count += 1;
    }

    // Convert map to sorted list
    const hotspots = Array.from(groups.values())
      .map((g) => {
        let avgLat: number | null = null;
        let avgLng: number | null = null;

        if (g.lats.length > 0) {
          avgLat = Number((g.lats.reduce((a, b) => a + b, 0) / g.lats.length).toFixed(4));
          avgLng = Number((g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length).toFixed(4));
        } else {
          // Fallback to known locality reference if possible
          const ref = GeoService.findLocalities(g.name)[0];
          if (ref) {
            avgLat = ref.latitude;
            avgLng = ref.longitude;
          }
        }

        // Determine top category
        let topCategoryName = 'None';
        let maxCatCount = 0;
        for (const cat of g.categoryCounts.values()) {
          if (cat.count > maxCatCount) {
            maxCatCount = cat.count;
            topCategoryName = cat.name;
          }
        }

        const actionable = g.total;
        const resolutionRate =
          actionable > 0 ? Number(((g.resolved / actionable) * 100).toFixed(1)) : 0;

        return {
          name: g.name,
          groupBy,
          totalComplaints: g.total,
          activeComplaints: g.active,
          resolvedComplaints: g.resolved,
          overdueComplaints: g.overdue,
          resolutionRate,
          topCategory: topCategoryName,
          topCategoryCount: maxCatCount,
          latitude: avgLat,
          longitude: avgLng,
        };
      })
      .sort((a, b) => b.totalComplaints - a.totalComplaints);

    return res.status(200).json({
      success: true,
      data: {
        groupBy,
        count: hotspots.length,
        hotspots,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 4. GET /api/geo/official-summary
 * Department-scoped geographic dashboard for municipal officials and admins
 */
export async function getOfficialGeoSummary(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required for official summary.' },
      });
    }

    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial = req.user.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isAdmin && !isOfficial) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access restricted to municipal officials and administrators.',
        },
      });
    }

    const where: Prisma.ComplaintWhereInput = {};

    // Officials are strictly scoped to their assigned department
    if (isOfficial && !isAdmin) {
      if (!req.user.departmentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_DEPARTMENT_ASSIGNED',
            message: 'Your official account is not assigned to a department.',
          },
        });
      }
      where.assignedDepartmentId = req.user.departmentId;
    }

    const [totalGrievances, unassignedCount, complaintsWithSla, departmentInfo] =
      await Promise.all([
        prisma.complaint.count({ where }),
        prisma.complaint.count({
          where: { ...where, assignedOfficialId: null },
        }),
        prisma.complaint.findMany({
          where,
          select: {
            id: true,
            status: true,
            priority: true,
            locality: true,
            ward: true,
            latitude: true,
            longitude: true,
            sla: {
              select: {
                slaStatus: true,
                currentResolutionDeadline: true,
                isResolutionOverdue: true,
                isResponseOverdue: true,
              },
            },
          },
        }),
        isOfficial && req.user.departmentId
          ? prisma.department.findUnique({
              where: { id: req.user.departmentId },
              select: { id: true, name: true, code: true },
            })
          : null,
      ]);

    // Compute ward breakdowns
    const wardMap = new Map<
      string,
      { ward: string; total: number; active: number; overdue: number }
    >();

    let totalOverdue = 0;
    let urgentActive = 0;

    for (const c of complaintsWithSla) {
      const w = c.ward?.trim() || 'Unassigned Ward';
      if (!wardMap.has(w)) {
        wardMap.set(w, { ward: w, total: 0, active: 0, overdue: 0 });
      }
      const item = wardMap.get(w)!;
      item.total += 1;

      const isResolved =
        c.status === ComplaintStatus.RESOLVED ||
        c.status === ComplaintStatus.VERIFIED ||
        c.status === ComplaintStatus.CLOSED;

      if (!isResolved && c.status !== ComplaintStatus.REJECTED) {
        item.active += 1;
        if (c.priority === 'URGENT') urgentActive += 1;
      }

      if (
        c.sla &&
        (c.sla.slaStatus === SlaStatus.RESPONSE_OVERDUE ||
          c.sla.slaStatus === SlaStatus.RESOLUTION_OVERDUE ||
          c.sla.slaStatus === SlaStatus.BREACHED ||
          c.sla.isResolutionOverdue ||
          c.sla.isResponseOverdue)
      ) {
        item.overdue += 1;
        totalOverdue += 1;
      }
    }

    const wardBreakdown = Array.from(wardMap.values()).sort((a, b) => b.total - a.total);

    return res.status(200).json({
      success: true,
      data: {
        department: departmentInfo,
        totalGrievances,
        unassignedCount,
        totalOverdue,
        urgentActive,
        wardBreakdown,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 5. GET /api/geo/localities
 * Returns known Bengaluru administrative localities with coordinates
 */
export async function getLocalities(req: Request, res: Response, next: NextFunction) {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const localities = GeoService.findLocalities(q);

    return res.status(200).json({
      success: true,
      data: {
        count: localities.length,
        localities,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 6. GET /api/geo/geocode
 * Lightweight geocoding lookup using offline reference dictionary
 */
export async function geocodeAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const address = String(req.query.q || req.query.address || '').trim();
    if (!address) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_QUERY', message: 'Address query parameter is required.' },
      });
    }

    const result = GeoService.geocodeOffline(address);
    if (!result) {
      return res.status(200).json({
        success: true,
        data: {
          found: false,
          query: address,
          message: 'No exact municipal landmark match found. Please adjust or enter coordinates.',
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        query: address,
        ...result,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * 7. PATCH /api/geo/complaints/:id/location
 * Updates or refines complaint coordinates and location metadata
 */
export async function updateComplaintLocation(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to update location.' },
      });
    }

    const id = String(req.params.id || '').trim();
    if (!isValidUuid(id)) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Complaint not found.' },
      });
    }

    // Authorization check: citizen creator, assigned official, or admin
    const isOwner = req.user.id === complaint.citizenId;
    const isAdmin = req.user.role === UserRole.ADMIN;
    const isOfficial =
      req.user.role === UserRole.GOVERNMENT_OFFICIAL &&
      (req.user.id === complaint.assignedOfficialId ||
        req.user.departmentId === complaint.assignedDepartmentId);

    if (!isOwner && !isAdmin && !isOfficial) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to update location for this complaint.',
        },
      });
    }

    const parseResult = updateComplaintLocationSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid location payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const {
      latitude,
      longitude,
      locationAddress,
      locality,
      ward,
      locationSource,
      locationAccuracy,
      isLocationPublic,
    } = parseResult.data;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.complaint.update({
        where: { id: complaint.id },
        data: {
          latitude: new Prisma.Decimal(latitude),
          longitude: new Prisma.Decimal(longitude),
          ...(locationAddress ? { locationAddress } : {}),
          ...(locality ? { locality } : {}),
          ...(ward !== undefined ? { ward } : {}),
          ...(locationSource ? { locationSource } : {}),
          ...(locationAccuracy !== undefined ? { locationAccuracy } : {}),
          ...(isLocationPublic !== undefined ? { isLocationPublic } : {}),
        },
      });

      // Audit log
      await tx.auditEvent.create({
        data: {
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          action: 'COMPLAINT_LOCATION_UPDATED',
          actorId: req.user!.id,
          details: {
            previousLat: complaint.latitude ? Number(complaint.latitude) : null,
            previousLng: complaint.longitude ? Number(complaint.longitude) : null,
            newLat: latitude,
            newLng: longitude,
            source: locationSource || 'MANUAL',
          },
        },
      });

      return result;
    });

    return res.status(200).json({
      success: true,
      data: {
        complaint: {
          id: updated.id,
          trackingId: updated.trackingId,
          latitude: Number(updated.latitude),
          longitude: Number(updated.longitude),
          locality: updated.locality,
          ward: updated.ward,
          locationSource: updated.locationSource,
          locationAccuracy: updated.locationAccuracy,
          isLocationPublic: updated.isLocationPublic,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}
