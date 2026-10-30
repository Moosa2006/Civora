import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { projectsQuerySchema } from '../validation/transparency.validation.js';

/**
 * GET /api/projects
 * Searchable, filterable list of formally registered civic works projects
 */
export async function getPublicProjects(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = projectsQuerySchema.safeParse(req.query);
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
    const { page, limit, status, departmentId, search } = query;

    const skip = (page - 1) * limit;
    const whereClause: Record<string, unknown> = {};

    if (status) {
      whereClause.workStatus = status;
    }
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }
    if (search && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { workOrderNumber: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
        { ward: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, projects] = await Promise.all([
      prisma.civicWork.count({ where: whereClause }),
      prisma.civicWork.findMany({
        where: whereClause,
        select: {
          id: true,
          workOrderNumber: true,
          title: true,
          description: true,
          workType: true,
          location: true,
          ward: true,
          estimatedBudget: true,
          sanctionedAmount: true,
          plannedStartDate: true,
          plannedEndDate: true,
          actualStartDate: true,
          actualCompletionDate: true,
          workStatus: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              complaintLinks: true,
              inspections: true,
              workOrders: true,
            },
          },
          workOrders: {
            take: 1,
            select: {
              id: true,
              workOrderNumber: true,
              contractAmount: true,
              executionStatus: true,
              contractor: {
                select: {
                  name: true,
                },
              },
              progressUpdates: {
                orderBy: { updateDate: 'desc' },
                take: 1,
                select: {
                  physicalProgressPercentage: true,
                  milestoneReached: true,
                  updateDate: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formattedProjects = projects.map((p) => {
      const primaryWorkOrder = p.workOrders[0];
      const latestProgress = primaryWorkOrder?.progressUpdates[0];

      let physicalProgress = 0;
      if (latestProgress?.physicalProgressPercentage) {
        physicalProgress = Number(latestProgress.physicalProgressPercentage);
      } else if (p.workStatus === 'COMPLETED') {
        physicalProgress = 100;
      } else if (p.workStatus === 'IN_PROGRESS') {
        physicalProgress = 50;
      } else if (p.workStatus === 'SANCTIONED' || p.workStatus === 'TENDERING') {
        physicalProgress = 15;
      }

      return {
        id: p.id,
        workOrderNumber: p.workOrderNumber,
        title: p.title,
        description: p.description,
        workType: p.workType,
        location: p.location,
        ward: p.ward,
        estimatedBudget: Number(p.estimatedBudget),
        sanctionedAmount: p.sanctionedAmount ? Number(p.sanctionedAmount) : null,
        plannedStartDate: p.plannedStartDate,
        plannedEndDate: p.plannedEndDate,
        actualStartDate: p.actualStartDate,
        actualCompletionDate: p.actualCompletionDate,
        workStatus: p.workStatus,
        department: p.department,
        contractorName: primaryWorkOrder?.contractor?.name || null,
        physicalProgressPercentage: physicalProgress,
        latestMilestone: latestProgress?.milestoneReached || null,
        linkedComplaintsCount: p._count.complaintLinks,
        inspectionsCount: p._count.inspections,
        createdAt: p.createdAt,
      };
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      data: {
        projects: formattedProjects,
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

/**
 * GET /api/projects/:id
 * Detailed public civic project monitoring view with progress updates & linked complaints
 */
export async function getPublicProjectById(req: Request, res: Response, next: NextFunction) {
  try {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : '';

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PROJECT_ID',
          message: 'A valid project ID is required.',
        },
      });
    }

    const project = await prisma.civicWork.findUnique({
      where: { id },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
          },
        },
        complaintLinks: {
          include: {
            complaint: {
              select: {
                id: true,
                trackingId: true,
                title: true,
                status: true,
                locality: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        inspections: {
          select: {
            id: true,
            inspectionDate: true,
            outcome: true,
            observations: true,
            measurements: true,
            notes: true,
          },
          orderBy: { inspectionDate: 'desc' },
        },
        workOrders: {
          include: {
            contractor: {
              select: {
                id: true,
                name: true,
                registrationNumber: true,
              },
            },
            progressUpdates: {
              orderBy: { updateDate: 'desc' },
              select: {
                id: true,
                updateDate: true,
                physicalProgressPercentage: true,
                financialProgressAmount: true,
                progressNotes: true,
                milestoneReached: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROJECT_NOT_FOUND',
          message: 'The requested civic works project does not exist.',
        },
      });
    }

    const primaryWorkOrder = project.workOrders[0];
    const progressUpdates = primaryWorkOrder?.progressUpdates || [];
    const latestProgress = progressUpdates[0];

    let overallProgress = 0;
    if (latestProgress?.physicalProgressPercentage) {
      overallProgress = Number(latestProgress.physicalProgressPercentage);
    } else if (project.workStatus === 'COMPLETED') {
      overallProgress = 100;
    } else if (project.workStatus === 'IN_PROGRESS') {
      overallProgress = 50;
    }

    return res.status(200).json({
      success: true,
      data: {
        project: {
          id: project.id,
          workOrderNumber: project.workOrderNumber,
          title: project.title,
          description: project.description,
          workType: project.workType,
          location: project.location,
          ward: project.ward,
          estimatedBudget: Number(project.estimatedBudget),
          sanctionedAmount: project.sanctionedAmount ? Number(project.sanctionedAmount) : null,
          plannedStartDate: project.plannedStartDate,
          plannedEndDate: project.plannedEndDate,
          actualStartDate: project.actualStartDate,
          actualCompletionDate: project.actualCompletionDate,
          workStatus: project.workStatus,
          department: project.department,
          contractor: primaryWorkOrder?.contractor || null,
          physicalProgressPercentage: overallProgress,
          progressUpdates: progressUpdates.map((u) => ({
            id: u.id,
            updateDate: u.updateDate,
            physicalProgressPercentage: Number(u.physicalProgressPercentage),
            financialProgressAmount: u.financialProgressAmount ? Number(u.financialProgressAmount) : null,
            progressNotes: u.progressNotes,
            milestoneReached: u.milestoneReached,
          })),
          inspections: project.inspections,
          linkedComplaints: project.complaintLinks.map((link) => ({
            id: link.complaint.id,
            trackingId: link.complaint.trackingId,
            title: link.complaint.title,
            status: link.complaint.status,
            locality: link.complaint.locality,
            categoryName: link.complaint.category?.name || 'Civic Issue',
            linkedNotes: link.notes,
          })),
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}
