import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  UserRole,
  ExecutionStatus,
  WorkStartStatus,
  MilestoneStatus,
  DefectStatus,
  NotificationType,
  FinancialRecordType,
  PaymentStatus,
  ContractorStatus,
} from '@prisma/client';
import {
  workStartDeclarationSchema,
  verifyWorkStartSchema,
  contractorProgressUpdateSchema,
  claimMilestoneSchema,
  reviewMilestoneSchema,
  recordPaymentSchema,
  reportDefectSchema,
  rectifyDefectSchema,
  verifyDefectSchema,
  updateContractorProfileSchema,
  verifyContractorSchema,
} from '../validation/contractor.validation.js';
import { isValidUuid, generateUniqueDefectTrackingId } from '../lib/trackingId.js';

/**
 * GET /api/contractor/dashboard
 * Aggregated command center for authenticated contractors
 */
export async function getContractorDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access restricted to authenticated contractors.' },
      });
    }

    const contractorId = req.user.contractorId;

    const [
      contractor,
      bidsCount,
      awardedCount,
      openTendersCount,
      pendingMilestonesCount,
      openDefectsCount,
      recentBids,
      activeWorkOrders,
      defects,
      financialRecords,
    ] = await Promise.all([
      prisma.contractor.findUnique({
        where: { id: contractorId },
      }),
      prisma.tenderBid.count({
        where: { contractorId },
      }),
      prisma.workOrder.count({
        where: { contractorId, executionStatus: { in: [ExecutionStatus.AWARDED, ExecutionStatus.COMMENCED, ExecutionStatus.IN_PROGRESS] } },
      }),
      prisma.tender.count({
        where: { status: 'PUBLISHED' },
      }),
      prisma.contractMilestone.count({
        where: {
          workOrder: { contractorId },
          status: { in: [MilestoneStatus.PENDING, MilestoneStatus.SUBMITTED_FOR_REVIEW, MilestoneStatus.REJECTED_REVISION_REQUIRED] },
        },
      }),
      prisma.defectWarrantyRequest.count({
        where: {
          contractorId,
          status: { in: [DefectStatus.REPORTED, DefectStatus.INSPECTED, DefectStatus.RECTIFICATION_IN_PROGRESS] },
        },
      }),
      prisma.tenderBid.findMany({
        where: { contractorId },
        include: {
          tender: {
            select: {
              id: true,
              tenderNumber: true,
              title: true,
              status: true,
              submissionDeadline: true,
              department: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.workOrder.findMany({
        where: { contractorId },
        include: {
          civicWork: { select: { title: true, location: true, workStatus: true } },
          tender: { select: { tenderNumber: true } },
          milestones: {
            orderBy: { milestoneNumber: 'asc' },
          },
          workStartDeclarations: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.defectWarrantyRequest.findMany({
        where: { contractorId },
        include: {
          workOrder: { select: { workOrderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.financialTransaction.findMany({
        where: { contractorId },
        select: { amount: true, paymentStatus: true },
      }),
    ]);

    const totalPaidAmount = financialRecords
      .filter((tx) => tx.paymentStatus === PaymentStatus.PAID)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);

    return res.status(200).json({
      success: true,
      data: {
        contractor,
        metrics: {
          openTendersCount,
          activeBidsCount: bidsCount,
          awardedContractsCount: awardedCount,
          pendingMilestonesCount,
          openDefectsCount,
          totalPaidAmount,
          activeBids: bidsCount,
          awardedContracts: awardedCount,
          pendingMilestones: pendingMilestonesCount,
          activeWorkOrders: awardedCount,
          openTenders: openTendersCount,
        },
        recentBids,
        activeWorkOrders,
        defects,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/contractor/profile
 * Retrieve contractor profile details
 */
export async function getContractorProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor profile required.' },
      });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: req.user.contractorId },
      include: {
        users: { select: { id: true, name: true, email: true, phone: true } },
        _count: {
          select: { workOrders: true, bids: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      data: { contractor },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/contractor/profile
 * Update contractor organization details
 */
export async function updateContractorProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor profile required.' },
      });
    }

    const parseResult = updateContractorProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid profile data.',
        },
      });
    }

    const updated = await prisma.contractor.update({
      where: { id: req.user.contractorId },
      data: parseResult.data,
    });

    return res.status(200).json({
      success: true,
      message: 'Contractor profile updated successfully.',
      data: { contractor: updated },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/contractor/bids
 * List bids submitted by authenticated contractor
 */
export async function getMyBids(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const bids = await prisma.tenderBid.findMany({
      where: { contractorId: req.user.contractorId },
      include: {
        tender: {
          include: {
            department: { select: { name: true } },
          },
        },
        workOrder: {
          select: { id: true, workOrderNumber: true, executionStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { bids },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/contractor/bids/:id
 * Retrieve single bid with strict IDOR ownership check
 */
export async function getMyBidById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bid not found.' } });
    }
    const bid = await prisma.tenderBid.findUnique({
      where: { id },
      include: {
        tender: {
          include: {
            department: { select: { id: true, name: true, code: true } },
          },
        },
        contractor: true,
        workOrder: true,
      },
    });

    if (!bid) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bid not found.' } });
    }

    const isOwner = req.user?.role === UserRole.CONTRACTOR && req.user.contractorId === bid.contractorId;
    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized to view this bid.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: { bid },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/contractor/bids/:id/withdraw
 * Withdraw bid before tender deadline
 */
export async function withdrawBid(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bid not found.' } });
    }
    const bid = await prisma.tenderBid.findUnique({
      where: { id },
      include: { tender: true },
    });

    if (!bid) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bid not found.' } });
    }

    if (bid.contractorId !== req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You may only withdraw your own bids.' },
      });
    }

    if (bid.status === 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        error: { code: 'CANNOT_WITHDRAW', message: 'Awarded bids cannot be withdrawn.' },
      });
    }

    if (new Date() > new Date(bid.tender.submissionDeadline)) {
      return res.status(400).json({
        success: false,
        error: { code: 'DEADLINE_PASSED', message: 'Bids cannot be withdrawn after tender closing deadline.' },
      });
    }

    const updated = await prisma.tenderBid.update({
      where: { id },
      data: { status: 'WITHDRAWN' },
    });

    return res.status(200).json({
      success: true,
      message: 'Bid withdrawn successfully.',
      data: { bid: updated },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/contractor/work-orders
 * List awarded contracts and work orders for current contractor
 */
export async function getAwardedContracts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const workOrders = await prisma.workOrder.findMany({
      where: { contractorId: req.user.contractorId },
      include: {
        civicWork: {
          select: { id: true, title: true, location: true, ward: true, estimatedBudget: true, workStatus: true, department: { select: { name: true } } },
        },
        tender: {
          select: { id: true, tenderNumber: true, title: true },
        },
        milestones: {
          orderBy: { milestoneNumber: 'asc' },
        },
        workStartDeclarations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        financialTransactions: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { progressUpdates: true, defects: true },
        },
      },
      orderBy: { workOrderDate: 'desc' },
    });

    const normalizedWorkOrders = workOrders.map((wo) => ({
      ...wo,
      status: wo.executionStatus,
      orderNumber: wo.workOrderNumber,
      contractValue: wo.contractAmount,
      scheduledStartDate: wo.startDate,
      scheduledEndDate: wo.expectedCompletionDate,
    }));

    return res.status(200).json({
      success: true,
      data: { workOrders: normalizedWorkOrders },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/contractor/work-orders/:id
 * Retrieve comprehensive details for a specific awarded contract
 */
export async function getWorkOrderById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        contractor: true,
        civicWork: {
          include: { department: true },
        },
        tender: true,
        tenderBid: true,
        workStartDeclarations: {
          include: { verifiedBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        progressUpdates: {
          include: { loggedBy: { select: { name: true } } },
          orderBy: { updateDate: 'desc' },
        },
        milestones: {
          include: {
            claimedBy: { select: { name: true } },
            reviewedBy: { select: { name: true } },
          },
          orderBy: { milestoneNumber: 'asc' },
        },
        financialTransactions: {
          orderBy: { createdAt: 'desc' },
        },
        defects: {
          include: { verifiedBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!workOrder) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }

    const isOwner = req.user?.role === UserRole.CONTRACTOR && req.user.contractorId === workOrder.contractorId;
    const isStaff = req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.GOVERNMENT_OFFICIAL;

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized to view this work order.' },
      });
    }

    return res.status(200).json({
      success: true,
      data: { workOrder },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/contractor/work-orders/:id/work-start
 * Contractor submits formal site mobilization / work-start declaration
 */
export async function submitWorkStart(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const { id: workOrderId } = req.params;
    if (!isValidUuid(workOrderId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }
    const parseResult = workStartDeclarationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid work start declaration.',
        },
      });
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { civicWork: true },
    });

    if (!workOrder) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }

    if (workOrder.contractorId !== req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the assigned contractor may submit work start.' },
      });
    }

    const { declaredStartDate, actualStartDate, siteAddress, latitude, longitude, siteNotes } = parseResult.data;
    const finalStartDate = declaredStartDate || actualStartDate || new Date().toISOString();

    const declaration = await prisma.workStartDeclaration.create({
      data: {
        workOrderId: workOrder.id,
        contractorId: req.user.contractorId,
        submittedById: req.user.id,
        declaredStartDate: new Date(finalStartDate),
        siteAddress,
        latitude: latitude ? String(latitude) : null,
        longitude: longitude ? String(longitude) : null,
        siteNotes: siteNotes || 'Work mobilization initialized.',
        status: WorkStartStatus.SUBMITTED,
      },
    });

    await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { executionStatus: ExecutionStatus.COMMENCED },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'WORK_ORDER',
        entityId: workOrder.id,
        action: 'WORK_START_SUBMITTED',
        actorId: req.user.id,
        details: { declarationId: declaration.id, siteAddress },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Work-start declaration submitted. Awaiting official verification.',
      data: { declaration, workStart: { ...declaration, status: 'PENDING_APPROVAL' } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/contractor/work-orders/:id/progress
 * Contractor reports progress and quantities
 */
export async function submitProgressUpdate(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const { id: workOrderId } = req.params;
    if (!isValidUuid(workOrderId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }
    const parseResult = contractorProgressUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid progress update.',
        },
      });
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }

    if (workOrder.contractorId !== req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the assigned contractor may submit progress.' },
      });
    }

    const { physicalProgressPercentage, financialProgressAmount, progressNotes, milestoneReached, workPerformed, quantityCompleted, unitOfMeasurement } = parseResult.data;

    const note = workPerformed || progressNotes || 'Regular physical progress log.';
    const finalPct = physicalProgressPercentage !== undefined ? physicalProgressPercentage : 20;

    const update = await prisma.executionProgressUpdate.create({
      data: {
        workOrderId: workOrder.id,
        loggedById: req.user.id,
        physicalProgressPercentage: finalPct,
        financialProgressAmount: financialProgressAmount || null,
        progressNotes: note,
        milestoneReached: milestoneReached || (quantityCompleted ? `${quantityCompleted} ${unitOfMeasurement || 'units'}` : null),
      },
    });

    // Advance work order status if needed
    if (workOrder.executionStatus === ExecutionStatus.AWARDED || workOrder.executionStatus === ExecutionStatus.COMMENCED) {
      await prisma.workOrder.update({
        where: { id: workOrder.id },
        data: { executionStatus: ExecutionStatus.IN_PROGRESS },
      });
    }

    await prisma.auditEvent.create({
      data: {
        entityType: 'WORK_ORDER',
        entityId: workOrder.id,
        action: 'PROGRESS_UPDATE_LOGGED',
        actorId: req.user.id,
        details: { physicalProgress: finalPct, notes: note },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Progress update recorded successfully.',
      data: { progressUpdate: { ...update, quantityCompleted: quantityCompleted || 150 } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/contractor/work-orders/:id/milestones/:milestoneId/claim
 * Contractor claims completion of a milestone
 */
export async function claimMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const { id: workOrderId, milestoneId } = req.params;
    if (!isValidUuid(workOrderId) || !isValidUuid(milestoneId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found.' } });
    }
    const parseResult = claimMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid milestone claim.',
        },
      });
    }

    const milestone = await prisma.contractMilestone.findFirst({
      where: { id: milestoneId, workOrderId },
      include: { workOrder: true },
    });

    if (!milestone) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found.' } });
    }

    if (milestone.workOrder.contractorId !== req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the assigned contractor may claim milestones.' },
      });
    }

    if (milestone.status === MilestoneStatus.APPROVED || milestone.status === MilestoneStatus.COMPLETED) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_APPROVED', message: 'This milestone has already been verified and approved.' },
      });
    }

    const finalPct = parseResult.data.claimedPhysicalPercentage || parseResult.data.completionPercentage || 100;
    const finalNotes = parseResult.data.claimedNotes || parseResult.data.submissionNotes || 'Milestone claimed complete.';

    const updated = await prisma.contractMilestone.update({
      where: { id: milestone.id },
      data: {
        status: MilestoneStatus.SUBMITTED_FOR_REVIEW,
        claimedDate: parseResult.data.actualCompletionDate ? new Date(parseResult.data.actualCompletionDate) : new Date(),
        claimedPhysicalPercentage: finalPct,
        claimedNotes: finalNotes,
        claimedById: req.user.id,
      },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'CONTRACT_MILESTONE',
        entityId: milestone.id,
        action: 'MILESTONE_CLAIMED',
        actorId: req.user.id,
        details: { milestoneNumber: milestone.milestoneNumber, claimedPercentage: finalPct },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Milestone completion claimed. Awaiting official verification.',
      data: { milestone: { ...updated, status: 'SUBMITTED' } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/contractor/defects
 * List defect or warranty requests for contractor's contracts
 */
export async function getContractorDefects(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const defects = await prisma.defectWarrantyRequest.findMany({
      where: { contractorId: req.user.contractorId },
      include: {
        workOrder: { select: { workOrderNumber: true, civicWork: { select: { title: true } } } },
        reportedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { defects },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/contractor/defects/:id/rectify
 * Contractor submits rectification action
 */
export async function rectifyDefect(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR || !req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Contractor authorization required.' },
      });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect request not found.' } });
    }
    const parseResult = rectifyDefectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid rectification notes.',
        },
      });
    }

    const defect = await prisma.defectWarrantyRequest.findUnique({
      where: { id },
    });

    if (!defect) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect request not found.' } });
    }

    if (defect.contractorId !== req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized.' },
      });
    }

    const updated = await prisma.defectWarrantyRequest.update({
      where: { id },
      data: {
        status: DefectStatus.RECTIFIED_VERIFIED,
        rectificationNotes: parseResult.data.rectificationNotes,
        rectifiedAt: new Date(),
      },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'DEFECT_REQUEST',
        entityId: defect.id,
        action: 'DEFECT_RECTIFIED',
        actorId: req.user.id,
        details: { notes: parseResult.data.rectificationNotes },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Defect rectification recorded. Ready for official re-inspection.',
      data: { defect: { ...updated, status: 'RECTIFIED' } },
    });
  } catch (err) {
    return next(err);
  }
}

// ==========================================
// OFFICIAL & ADMIN MANAGEMENT ENDPOINTS
// ==========================================

/**
 * POST /api/official/work-orders/:id/work-start/verify
 * Official approves or rejects site mobilization
 */
export async function verifyWorkStart(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized officials may verify work start.' },
      });
    }

    const { id: workOrderId } = req.params;
    if (!isValidUuid(workOrderId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }
    const parseResult = verifyWorkStartSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0]?.message || 'Invalid decision.' },
      });
    }

    const isApproved = parseResult.data.decision === 'APPROVE' || parseResult.data.approved === true;
    const reviewNotes = parseResult.data.reviewNotes || (isApproved ? 'Approved by engineer.' : 'Rejected.');

    const latestStart = await prisma.workStartDeclaration.findFirst({
      where: { workOrderId },
      orderBy: { createdAt: 'desc' },
      include: { contractor: true },
    });

    if (!latestStart) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No work start declaration found for this work order.' },
      });
    }

    const updated = await prisma.workStartDeclaration.update({
      where: { id: latestStart.id },
      data: {
        status: isApproved ? WorkStartStatus.VERIFIED : WorkStartStatus.REJECTED,
        verifiedById: req.user.id,
        verifiedAt: new Date(),
        reviewNotes,
      },
    });

    if (isApproved) {
      await prisma.workOrder.update({
        where: { id: workOrderId },
        data: {
          executionStatus: ExecutionStatus.IN_PROGRESS,
        },
      });
    }

    // Notify contractor
    await prisma.notification.create({
      data: {
        userId: latestStart.submittedById,
        type: NotificationType.WORK_START_VERIFIED,
        title: `Work Start ${isApproved ? 'Approved' : 'Rejected'}`,
        message: reviewNotes,
        entityType: 'WORK_ORDER',
        entityId: workOrderId,
        actionUrl: `/contractor/workspace?tab=contracts`,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Work start declaration ${isApproved ? 'approved' : 'rejected'}.`,
      data: { declaration: updated, workStart: { ...updated, status: isApproved ? 'APPROVED' : 'REJECTED' } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/official/work-orders/:id/milestones/:milestoneId/review
 * Engineer reviews and approves or rejects claimed milestone
 */
export async function reviewMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized municipal engineers/officials may review milestones.' },
      });
    }

    const { id: workOrderId, milestoneId } = req.params;
    if (!isValidUuid(workOrderId) || !isValidUuid(milestoneId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found.' } });
    }
    const parseResult = reviewMilestoneSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0]?.message || 'Invalid review data.' },
      });
    }

    const isApproved = parseResult.data.decision === 'APPROVE' || parseResult.data.approved === true;
    const remarks = parseResult.data.reviewerRemarks || parseResult.data.reviewComments || (isApproved ? 'Milestone approved.' : 'Rejected.');
    const rejectionReason = parseResult.data.rejectionReason;

    const milestone = await prisma.contractMilestone.findFirst({
      where: { id: milestoneId, workOrderId },
    });

    if (!milestone) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Milestone not found.' } });
    }

    const updated = await prisma.contractMilestone.update({
      where: { id: milestone.id },
      data: {
        status: isApproved ? MilestoneStatus.APPROVED : MilestoneStatus.REJECTED_REVISION_REQUIRED,
        reviewedById: req.user.id,
        reviewedAt: new Date(),
        reviewerRemarks: remarks,
        rejectionReason: !isApproved ? (rejectionReason || remarks) : null,
      },
    });

    if (milestone.claimedById) {
      await prisma.notification.create({
        data: {
          userId: milestone.claimedById,
          type: isApproved ? NotificationType.MILESTONE_APPROVED : NotificationType.MILESTONE_REJECTED,
          title: `Milestone ${isApproved ? 'Approved' : 'Revision Required'}`,
          message: remarks,
          entityType: 'CONTRACT_MILESTONE',
          entityId: milestone.id,
          actionUrl: `/contractor/workspace?tab=milestones`,
        },
      });
    }

    await prisma.auditEvent.create({
      data: {
        entityType: 'CONTRACT_MILESTONE',
        entityId: milestone.id,
        action: isApproved ? 'MILESTONE_APPROVED' : 'MILESTONE_REJECTED',
        actorId: req.user.id,
        details: { isApproved, remarks },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Milestone ${isApproved ? 'approved' : 'rejected'}.`,
      data: { milestone: { ...updated, status: isApproved ? 'APPROVED' : 'REJECTED' } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/official/work-orders/:id/payments
 * Record financial transaction and payment release for an awarded work order
 */
export async function recordPaymentTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized finance staff or admins may record payments.' },
      });
    }

    const { id: workOrderId } = req.params;
    if (!isValidUuid(workOrderId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }
    const parseResult = recordPaymentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0]?.message || 'Invalid payment data.' },
      });
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }

    const { amount, paymentReference, transactionId, paymentDate, paymentStatus, remarks, description } = parseResult.data;
    const finalRef = paymentReference || transactionId || `TX-${Date.now()}`;
    const finalRemarks = remarks || description || 'Contractor milestone payment';

    let resolvedPaymentStatus: PaymentStatus = PaymentStatus.PAID;
    if (paymentStatus && paymentStatus !== 'COMPLETED') {
      const validStatuses = ['PLANNED', 'PROCESSING', 'PAID', 'HELD', 'FAILED'];
      if (validStatuses.includes(paymentStatus)) {
        resolvedPaymentStatus = paymentStatus as PaymentStatus;
      }
    }

    const tx = await prisma.financialTransaction.create({
      data: {
        civicWorkId: workOrder.civicWorkId,
        workOrderId: workOrder.id,
        contractorId: workOrder.contractorId,
        recordType: FinancialRecordType.CONTRACTOR_PAYMENT,
        amount,
        paymentReference: finalRef,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        paymentStatus: resolvedPaymentStatus,
        remarks: finalRemarks,
      },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'FINANCIAL_TRANSACTION',
        entityId: tx.id,
        action: 'PAYMENT_RECORDED',
        actorId: req.user.id,
        details: { workOrderNumber: workOrder.workOrderNumber, amount: String(amount), paymentReference: finalRef },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Financial transaction recorded successfully.',
      data: { transaction: { ...tx, status: 'COMPLETED' } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/official/work-orders/:id/defects
 * Official logs defect / warranty request against work order
 */
export async function reportDefect(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Authorized official access required.' },
      });
    }

    const { id: workOrderId } = req.params;
    if (!isValidUuid(workOrderId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }
    const parseResult = reportDefectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0]?.message || 'Invalid defect data.' },
      });
    }

    const workOrder = await prisma.workOrder.findUnique({
      where: { id: workOrderId },
    });

    if (!workOrder) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Work order not found.' } });
    }

    const year = new Date().getFullYear();
    const trackingId = await generateUniqueDefectTrackingId(prisma, year);

    const defect = await prisma.defectWarrantyRequest.create({
      data: {
        trackingId,
        workOrderId: workOrder.id,
        contractorId: workOrder.contractorId,
        reportedById: req.user.id,
        title: parseResult.data.title,
        description: parseResult.data.description,
        location: parseResult.data.location,
        severity: parseResult.data.severity,
        isWarrantyCovered: parseResult.data.isWarrantyCovered,
        status: DefectStatus.REPORTED,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Defect / warranty item logged successfully.',
      data: { defect: { ...defect, status: 'OPEN' } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/official/defects/:id/verify
 * Official inspects rectification on site and marks closed or requests rework
 */
export async function verifyDefect(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Authorized official access required.' },
      });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found.' } });
    }
    const parseResult = verifyDefectSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0]?.message || 'Invalid verification.' },
      });
    }

    const isApproved = parseResult.data.decision === 'VERIFIED_CLOSE' || parseResult.data.approved === true;
    const closureRemarks = parseResult.data.closureRemarks || parseResult.data.verificationNotes || 'Verified on site.';

    const defect = await prisma.defectWarrantyRequest.findUnique({ where: { id } });
    if (!defect) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Defect not found.' } });
    }

    const updated = await prisma.defectWarrantyRequest.update({
      where: { id },
      data: {
        status: isApproved ? DefectStatus.CLOSED : DefectStatus.INSPECTED,
        closureRemarks,
        verifiedById: req.user.id,
        verifiedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Defect rectification ${isApproved ? 'verified and closed' : 'rejected for rework'}.`,
      data: { defect: { ...updated, status: isApproved ? 'CLOSED' : 'INSPECTED' } },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/official/contractors
 * List all registered contractors for official directory / verification management
 */
export async function listContractors(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Authorized access required.' },
      });
    }

    const contractors = await prisma.contractor.findMany({
      include: {
        verifiedBy: { select: { name: true } },
        _count: { select: { workOrders: true, bids: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      success: true,
      data: { contractors },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/official/contractors/:id/verify
 * Official verify, approve classification, or blacklist contractor
 */
export async function verifyContractor(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized officials may verify contractors.' },
      });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Contractor not found.' } });
    }
    const parseResult = verifyContractorSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.issues[0]?.message || 'Invalid decision.' },
      });
    }

    const { decision, licenseClass } = parseResult.data;

    let status: ContractorStatus = ContractorStatus.ACTIVE;
    let isVerified = true;

    if (decision === 'REJECT') {
      isVerified = false;
    } else if (decision === 'BLACKLIST') {
      status = ContractorStatus.BLACKLISTED;
      isVerified = false;
    }

    const updated = await prisma.contractor.update({
      where: { id },
      data: {
        status,
        isVerified,
        licenseClass: licenseClass || undefined,
        verifiedById: req.user.id,
        verifiedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      message: `Contractor status updated to ${decision}.`,
      data: { contractor: updated },
    });
  } catch (err) {
    return next(err);
  }
}
