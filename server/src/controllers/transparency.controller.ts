import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  trendsQuerySchema,
  publicComplaintsQuerySchema,
} from '../validation/transparency.validation.js';
import { ComplaintStatus, CivicWorkStatus } from '@prisma/client';

/**
 * GET /api/transparency/metrics
 * Comprehensive public transparency metrics derived from actual PostgreSQL records
 */
export async function getPublicMetrics(_req: Request, res: Response, next: NextFunction) {
  try {
    const [totalComplaints, complaintsGroupedByStatus, resolvedComplaintsWithDates, civicWorksGroupedByStatus, progressRecords] =
      await Promise.all([
        prisma.complaint.count(),
        prisma.complaint.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.complaint.findMany({
          where: {
            resolvedAt: { not: null },
          },
          select: {
            createdAt: true,
            resolvedAt: true,
          },
        }),
        prisma.civicWork.groupBy({
          by: ['workStatus'],
          _count: { workStatus: true },
        }),
        prisma.executionProgressUpdate.findMany({
          select: {
            physicalProgressPercentage: true,
          },
        }),
      ]);

    // Map status counts
    const statusCounts: Record<ComplaintStatus, number> = {
      SUBMITTED: 0,
      UNDER_REVIEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      VERIFIED: 0,
      REOPENED: 0,
      REJECTED: 0,
      CLOSED: 0,
    };

    complaintsGroupedByStatus.forEach((item) => {
      statusCounts[item.status] = item._count.status;
    });

    const openCount =
      statusCounts.SUBMITTED +
      statusCounts.UNDER_REVIEW +
      statusCounts.ASSIGNED +
      statusCounts.IN_PROGRESS +
      statusCounts.REOPENED;

    const resolvedCount = statusCounts.RESOLVED + statusCounts.VERIFIED + statusCounts.CLOSED;
    const actionableTotal = totalComplaints - statusCounts.REJECTED;
    const resolutionRate =
      actionableTotal > 0 ? Number(((resolvedCount / actionableTotal) * 100).toFixed(1)) : 0;

    // Calculate resolution durations in hours
    const resolutionDurationsHours: number[] = [];
    resolvedComplaintsWithDates.forEach((c) => {
      if (c.resolvedAt && c.createdAt) {
        const diffMs = c.resolvedAt.getTime() - c.createdAt.getTime();
        if (diffMs >= 0) {
          resolutionDurationsHours.push(Number((diffMs / (1000 * 60 * 60)).toFixed(1)));
        }
      }
    });

    let averageResolutionHours: number | null = null;
    let medianResolutionHours: number | null = null;

    if (resolutionDurationsHours.length > 0) {
      const sum = resolutionDurationsHours.reduce((acc, curr) => acc + curr, 0);
      averageResolutionHours = Number((sum / resolutionDurationsHours.length).toFixed(1));

      const sorted = [...resolutionDurationsHours].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      medianResolutionHours =
        sorted.length % 2 !== 0
          ? sorted[mid]
          : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
    }

    // Civic projects metrics
    const projectStatusCounts: Record<CivicWorkStatus, number> = {
      PROPOSED: 0,
      SANCTIONED: 0,
      TENDERING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    let totalProjects = 0;
    civicWorksGroupedByStatus.forEach((item) => {
      projectStatusCounts[item.workStatus] = item._count.workStatus;
      totalProjects += item._count.workStatus;
    });

    let averageProjectProgress: number | null = null;
    if (progressRecords.length > 0) {
      const progSum = progressRecords.reduce(
        (acc, r) => acc + Number(r.physicalProgressPercentage),
        0
      );
      averageProjectProgress = Number((progSum / progressRecords.length).toFixed(1));
    }

    return res.status(200).json({
      success: true,
      data: {
        complaints: {
          total: totalComplaints,
          open: openCount,
          assigned: statusCounts.ASSIGNED,
          inProgress: statusCounts.IN_PROGRESS,
          resolved: statusCounts.RESOLVED,
          verified: statusCounts.VERIFIED,
          reopened: statusCounts.REOPENED,
          rejected: statusCounts.REJECTED,
          closed: statusCounts.CLOSED,
          resolutionRate,
          averageResolutionHours,
          medianResolutionHours,
          statusBreakdown: statusCounts,
        },
        civicProjects: {
          total: totalProjects,
          active:
            projectStatusCounts.IN_PROGRESS +
            projectStatusCounts.SANCTIONED +
            projectStatusCounts.TENDERING,
          completed: projectStatusCounts.COMPLETED,
          statusBreakdown: projectStatusCounts,
          averagePhysicalProgress: averageProjectProgress,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/transparency/trends
 * Daily time series for complaint lodging vs resolution over a selected date range
 */
export async function getPublicTrends(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = trendsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }
    const query = parseResult.data;
    const days = query.days || 30;

    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - days);
    startDate.setUTCHours(0, 0, 0, 0);

    const complaints = await prisma.complaint.findMany({
      where: {
        OR: [{ createdAt: { gte: startDate } }, { resolvedAt: { gte: startDate } }],
      },
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    // Generate chronological buckets for each day
    const buckets: Record<string, { date: string; submitted: number; resolved: number }> = {};
    const curr = new Date(startDate);
    const now = new Date();

    while (curr <= now) {
      const dateKey = curr.toISOString().split('T')[0];
      buckets[dateKey] = { date: dateKey, submitted: 0, resolved: 0 };
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    complaints.forEach((c) => {
      const createdKey = c.createdAt.toISOString().split('T')[0];
      if (buckets[createdKey]) {
        buckets[createdKey].submitted += 1;
      }
      if (c.resolvedAt) {
        const resolvedKey = c.resolvedAt.toISOString().split('T')[0];
        if (buckets[resolvedKey]) {
          buckets[resolvedKey].resolved += 1;
        }
      }
    });

    const timeline = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));

    return res.status(200).json({
      success: true,
      data: {
        periodDays: days,
        startDate: startDate.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        timeline,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/transparency/status-distribution
 * Granular breakdown by status, category, and priority
 */
export async function getStatusDistribution(_req: Request, res: Response, next: NextFunction) {
  try {
    const [totalComplaints, byStatusGroup, byCategoryGroup, byPriorityGroup, categories] =
      await Promise.all([
        prisma.complaint.count(),
        prisma.complaint.groupBy({
          by: ['status'],
          _count: { status: true },
        }),
        prisma.complaint.groupBy({
          by: ['categoryId'],
          _count: { categoryId: true },
        }),
        prisma.complaint.groupBy({
          by: ['priority'],
          _count: { priority: true },
        }),
        prisma.complaintCategory.findMany({
          select: { id: true, code: true, name: true },
        }),
      ]);

    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    const statusDistribution = byStatusGroup.map((item) => ({
      status: item.status,
      count: item._count.status,
      percentage:
        totalComplaints > 0
          ? Number(((item._count.status / totalComplaints) * 100).toFixed(1))
          : 0,
    }));

    const categoryDistribution = byCategoryGroup.map((item) => {
      const cat = categoryMap.get(item.categoryId);
      return {
        categoryId: item.categoryId,
        code: cat?.code || 'UNKNOWN',
        name: cat?.name || 'Uncategorized',
        count: item._count.categoryId,
        percentage:
          totalComplaints > 0
            ? Number(((item._count.categoryId / totalComplaints) * 100).toFixed(1))
            : 0,
      };
    });

    const priorityDistribution = byPriorityGroup.map((item) => ({
      priority: item.priority,
      count: item._count.priority,
      percentage:
        totalComplaints > 0
          ? Number(((item._count.priority / totalComplaints) * 100).toFixed(1))
          : 0,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalComplaints,
        byStatus: statusDistribution,
        byCategory: categoryDistribution,
        byPriority: priorityDistribution,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/transparency/departments
 * Department-level accountability metrics with fair comparative indicators
 */
export async function getDepartmentAccountability(_req: Request, res: Response, next: NextFunction) {
  try {
    const [departments, totalComplaints] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          assignedComplaints: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              resolvedAt: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.complaint.count(),
    ]);

    const departmentMetrics = departments.map((dept) => {
      const assigned = dept.assignedComplaints;
      const totalAssigned = assigned.length;

      let activeCount = 0;
      let resolvedCount = 0;
      let verifiedCount = 0;
      let reopenedCount = 0;
      const resolutionHoursList: number[] = [];

      assigned.forEach((c) => {
        if (
          c.status === 'ASSIGNED' ||
          c.status === 'IN_PROGRESS' ||
          c.status === 'UNDER_REVIEW'
        ) {
          activeCount += 1;
        }
        if (c.status === 'RESOLVED' || c.status === 'VERIFIED' || c.status === 'CLOSED') {
          resolvedCount += 1;
        }
        if (c.status === 'VERIFIED') {
          verifiedCount += 1;
        }
        if (c.status === 'REOPENED') {
          reopenedCount += 1;
          activeCount += 1;
        }

        if (c.resolvedAt && c.createdAt) {
          const diffMs = c.resolvedAt.getTime() - c.createdAt.getTime();
          if (diffMs >= 0) {
            resolutionHoursList.push(diffMs / (1000 * 60 * 60));
          }
        }
      });

      const resolutionRate =
        totalAssigned > 0 ? Number(((resolvedCount / totalAssigned) * 100).toFixed(1)) : 0;

      const avgResolutionHours =
        resolutionHoursList.length > 0
          ? Number(
              (
                resolutionHoursList.reduce((a, b) => a + b, 0) / resolutionHoursList.length
              ).toFixed(1)
            )
          : null;

      const workloadShare =
        totalComplaints > 0 ? Number(((totalAssigned / totalComplaints) * 100).toFixed(1)) : 0;

      return {
        id: dept.id,
        code: dept.code,
        name: dept.name,
        description: dept.description,
        totalAssigned,
        activeCount,
        resolvedCount,
        verifiedCount,
        reopenedCount,
        resolutionRate,
        avgResolutionHours,
        workloadShare,
        contextNote: `${totalAssigned} grievances assigned (${workloadShare}% of city-wide grievances)`,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        departments: departmentMetrics,
        context: {
          totalCityComplaints: totalComplaints,
          fairComparisonGuidance:
            'Resolution rates and turnaround times should be interpreted in the context of total workload volume and jurisdictional complexity.',
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/transparency/complaints
 * Public-safe searchable, filterable complaint explorer (Zero Citizen PII)
 */
export async function getPublicComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = publicComplaintsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue ? issue.message : 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }
    const query = parseResult.data;
    const { page, limit, status, categoryId, departmentId, search, startDate, endDate } = query;

    const skip = (page - 1) * limit;

    const whereClause: Record<string, unknown> = {};

    if (status) {
      whereClause.status = status;
    }
    if (categoryId) {
      whereClause.categoryId = categoryId;
    }
    if (departmentId) {
      whereClause.assignedDepartmentId = departmentId;
    }

    if (startDate || endDate) {
      whereClause.createdAt = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      };
    }

    if (search && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { trackingId: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { locality: { contains: term, mode: 'insensitive' } },
        { ward: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, complaints] = await Promise.all([
      prisma.complaint.count({ where: whereClause }),
      prisma.complaint.findMany({
        where: whereClause,
        select: {
          id: true,
          trackingId: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          locality: true,
          ward: true,
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
          createdAt: true,
          resolvedAt: true,
          verifiedAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        complaints,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}
