import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { UserRole, TenderStatus, BidStatus, ExecutionStatus, NotificationType } from '@prisma/client';
import {
  tenderQuerySchema,
  createTenderSchema,
  updateTenderSchema,
  submitBidSchema,
  evaluateBidSchema,
  awardTenderSchema,
} from '../validation/contractor.validation.js';
import {
  generateUniqueTenderNumber,
  generateUniqueBidNumber,
  generateUniqueWorkOrderNumber,
  isValidUuid,
} from '../lib/trackingId.js';

// License class ranking hierarchy
const CLASS_RANKS: Record<string, number> = {
  ANY: 0,
  CLASS_C: 1,
  CLASS_B: 2,
  CLASS_A: 3,
  SPECIALIZED: 4,
};

function evaluateContractorEligibility(
  tender: {
    minimumContractorClass: string | null;
    categoryCode: string;
    submissionDeadline: Date;
    status: TenderStatus;
  },
  contractor: {
    status: string;
    isVerified: boolean;
    licenseClass: string | null;
    workCategories: string[];
  } | null,
  alreadyBid = false
) {
  const isDeadlinePassed = new Date() > new Date(tender.submissionDeadline);
  const requiredClass = tender.minimumContractorClass || 'ANY';

  if (!contractor) {
    return {
      isEligible: false,
      canBid: false,
      status: 'INSUFFICIENT_INFORMATION',
      reason: 'No registered contractor organization profile found for this account.',
      reasons: ['No registered contractor organization profile found for this account.'],
      details: {
        isVerified: false,
        status: 'UNKNOWN',
        contractorClass: null,
        requiredClass,
        deadlinePassed: isDeadlinePassed,
        alreadyBid,
      },
    };
  }

  const reasons: string[] = [];
  let isEligible = true;

  if (contractor.status !== 'ACTIVE') {
    isEligible = false;
    reasons.push(`Contractor account status is currently ${contractor.status}.`);
  }

  if (!contractor.isVerified) {
    isEligible = false;
    reasons.push('Contractor credentials require official municipal verification before bidding.');
  }

  const requiredRank = CLASS_RANKS[requiredClass] || 0;
  const contractorRank = CLASS_RANKS[contractor.licenseClass || 'CLASS_C'] || 1;

  if (contractorRank < requiredRank) {
    isEligible = false;
    reasons.push(`Tender requires ${requiredClass} contractor license, but your current profile holds ${contractor.licenseClass || 'CLASS_C'}.`);
  }

  if (
    tender.categoryCode &&
    contractor.workCategories &&
    contractor.workCategories.length > 0 &&
    !contractor.workCategories.includes(tender.categoryCode)
  ) {
    reasons.push(`Work category ${tender.categoryCode} is not listed in your registered capabilities. Additional review will be required.`);
  }

  if (isDeadlinePassed) {
    isEligible = false;
    reasons.push('The submission deadline for this tender has expired.');
  }

  if (tender.status !== TenderStatus.PUBLISHED) {
    isEligible = false;
    reasons.push(`Tender is not currently accepting bids (status: ${tender.status}).`);
  }

  const canBid = isEligible && !alreadyBid;
  if (alreadyBid) {
    reasons.push('You have already submitted a bid for this tender.');
  }

  const reason = reasons.length > 0 ? reasons[0] : 'All standard eligibility criteria met.';

  return {
    isEligible,
    canBid,
    status: isEligible ? 'ELIGIBLE' : reasons.some((r) => r.includes('verification')) ? 'REQUIRES_REVIEW' : 'INELIGIBLE',
    reason,
    reasons: reasons.length > 0 ? reasons : ['All standard eligibility criteria met.'],
    details: {
      isVerified: Boolean(contractor.isVerified),
      status: contractor.status,
      contractorClass: contractor.licenseClass,
      requiredClass,
      deadlinePassed: isDeadlinePassed,
      alreadyBid,
    },
  };
}

/**
 * GET /api/tenders
 * Public and contractor directory of tenders
 */
export async function getTenders(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = tenderQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid query parameters.',
        },
      });
    }

    const { page, limit, category, departmentId, status, search } = parseResult.data;
    const skip = (page - 1) * limit;

    const isStaff = req.user && (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);

    const where: Record<string, unknown> = {};

    // For non-staff, only show published, under-evaluation, or awarded tenders
    if (!isStaff) {
      if (status && status !== TenderStatus.DRAFT) {
        where.status = status;
      } else {
        where.status = { in: [TenderStatus.PUBLISHED, TenderStatus.UNDER_EVALUATION, TenderStatus.AWARDED] };
      }
    } else if (status) {
      where.status = status;
    }

    if (category) {
      where.categoryCode = category;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { tenderNumber: { contains: term, mode: 'insensitive' } },
        { title: { contains: term, mode: 'insensitive' } },
        { location: { contains: term, mode: 'insensitive' } },
        { categoryCode: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, tenders] = await Promise.all([
      prisma.tender.count({ where }),
      prisma.tender.findMany({
        where,
        include: {
          department: {
            select: { id: true, code: true, name: true },
          },
          civicWork: {
            select: { id: true, workOrderNumber: true, title: true },
          },
          _count: {
            select: { bids: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const normalizedTenders = tenders.map((t) => ({
      ...t,
      category: t.categoryCode,
      minLicenseClass: t.minimumContractorClass,
      publishedAt: t.publicationDate,
    }));

    return res.status(200).json({
      success: true,
      data: {
        tenders: normalizedTenders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/tenders/:id
 * Retrieve comprehensive tender details, documents, and eligibility evaluation
 */
export async function getTenderById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const tender = await prisma.tender.findFirst({
      where: isUuid ? { OR: [{ id }, { tenderNumber: id }] } : { tenderNumber: id },
      include: {
        department: {
          select: { id: true, code: true, name: true },
        },
        civicWork: {
          select: { id: true, workOrderNumber: true, title: true, location: true, estimatedBudget: true },
        },
        createdBy: {
          select: { id: true, name: true, role: true },
        },
        awardedBid: {
          select: {
            id: true,
            bidNumber: true,
            bidAmount: true,
            contractor: {
              select: { name: true, registrationNumber: true },
            },
          },
        },
        documents: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true, documentCategory: true, uploadTimestamp: true },
        },
        _count: {
          select: { bids: true },
        },
      },
    });

    if (!tender) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Tender not found.' },
      });
    }

    // Evaluate eligibility if caller is an authenticated contractor
    let eligibility = null;
    let myBid = null;

    if (req.user && req.user.role === UserRole.CONTRACTOR && req.user.contractorId) {
      const contractor = await prisma.contractor.findUnique({
        where: { id: req.user.contractorId },
        select: {
          id: true,
          name: true,
          status: true,
          isVerified: true,
          licenseClass: true,
          workCategories: true,
        },
      });

      const rawBid = await prisma.tenderBid.findFirst({
        where: { tenderId: tender.id, contractorId: req.user.contractorId },
        select: {
          id: true,
          bidNumber: true,
          bidAmount: true,
          proposedDurationDays: true,
          technicalProposal: true,
          status: true,
          officialEvaluationNotes: true,
          createdAt: true,
        },
      });

      if (rawBid) {
        myBid = {
          ...rawBid,
          submittedAt: rawBid.createdAt,
        };
      }

      eligibility = evaluateContractorEligibility(tender, contractor, Boolean(myBid));
    }

    return res.status(200).json({
      success: true,
      data: {
        tender: {
          ...tender,
          category: tender.categoryCode,
          minLicenseClass: tender.minimumContractorClass,
          publishedAt: tender.publicationDate,
          technicalCriteria: tender.eligibilityCriteria,
          eligibility,
          myBid,
        },
        eligibility,
        myBid,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/tenders
 * Authorized officials create draft tenders
 */
export async function createTender(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized officials and administrators may create tenders.' },
      });
    }

    const parseResult = createTenderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid tender payload.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const data = parseResult.data;

    let targetDeptId = data.departmentId;
    if (!targetDeptId) {
      targetDeptId = req.user.departmentId || (await prisma.department.findFirst({ select: { id: true } }))?.id;
    }
    if (!targetDeptId) {
      return res.status(400).json({ success: false, error: { code: 'NO_DEPARTMENT', message: 'No department available to associate with tender.' } });
    }

    // Enforce department scoping for officials if departmentId explicitly provided
    if (req.user.role === UserRole.GOVERNMENT_OFFICIAL && req.user.departmentId && data.departmentId && req.user.departmentId !== data.departmentId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Officials may only create tenders within their assigned department.' },
      });
    }

    // Generate or preserve collision-resistant tender number
    const year = new Date().getFullYear();
    const tenderNumber = data.tenderNumber || (await generateUniqueTenderNumber(prisma, year));
    const categoryCode = data.categoryCode || data.category || 'ROADS_AND_BRIDGES';
    const minClass = data.minimumContractorClass || data.minLicenseClass || 'ANY';

    const newTender = await prisma.tender.create({
      data: {
        tenderNumber,
        title: data.title,
        description: data.description,
        departmentId: targetDeptId,
        civicWorkId: data.civicWorkId || null,
        categoryCode,
        location: data.location || 'Municipal Jurisdiction',
        ward: data.ward || null,
        estimatedBudget: data.estimatedBudget,
        earnestMoneyDeposit: data.earnestMoneyDeposit || null,
        minimumContractorClass: minClass,
        status: TenderStatus.DRAFT,
        submissionDeadline: new Date(data.submissionDeadline),
        expectedDurationDays: data.expectedDurationDays || null,
        eligibilityCriteria: data.eligibilityCriteria || data.technicalCriteria || null,
        scopeOfWork: data.scopeOfWork || null,
        createdById: req.user.id,
      },
    });

    // Record audit event
    await prisma.auditEvent.create({
      data: {
        entityType: 'TENDER',
        entityId: newTender.id,
        action: 'TENDER_CREATED',
        actorId: req.user.id,
        details: { tenderNumber: newTender.tenderNumber, estimatedBudget: String(newTender.estimatedBudget) },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Draft tender created successfully.',
      data: { tender: newTender },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/tenders/:id
 * Authorized officials update draft tenders
 */
export async function updateTender(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized to modify tender.' },
      });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }
    const existing = await prisma.tender.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }

    if (existing.status !== TenderStatus.DRAFT) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Only draft tenders can be edited. Published or closed tenders cannot be modified.' },
      });
    }

    const parseResult = updateTenderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid payload.',
        },
      });
    }

    const data = parseResult.data;
    const updated = await prisma.tender.update({
      where: { id },
      data: {
        ...data,
        submissionDeadline: data.submissionDeadline ? new Date(data.submissionDeadline) : undefined,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Tender updated successfully.',
      data: { tender: updated },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/tenders/:id/publish
 * Publish draft tender to open bidding
 */
export async function publishTender(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized to publish tender.' },
      });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }
    const tender = await prisma.tender.findUnique({ where: { id } });
    if (!tender) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }

    if (tender.status !== TenderStatus.DRAFT) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: `Cannot publish tender in status ${tender.status}.` },
      });
    }

    if (new Date(tender.submissionDeadline) <= new Date()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DEADLINE', message: 'Tender submission deadline must be in the future.' },
      });
    }

    const published = await prisma.tender.update({
      where: { id },
      data: {
        status: TenderStatus.PUBLISHED,
        publicationDate: new Date(),
      },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'TENDER',
        entityId: published.id,
        action: 'TENDER_PUBLISHED',
        actorId: req.user.id,
        details: { tenderNumber: published.tenderNumber, deadline: published.submissionDeadline },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Tender published successfully for public contractor bidding.',
      data: { tender: published },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/tenders/:id/bids
 * Contractor submits bid for published tender
 */
export async function submitBid(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.CONTRACTOR) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only registered contractors may submit bids.' },
      });
    }

    if (!req.user.contractorId) {
      return res.status(403).json({
        success: false,
        error: { code: 'PROFILE_MISSING', message: 'Your account is not linked to an active contractor organization.' },
      });
    }

    const tenderId = String(req.params.id);

    const parseResult = submitBidSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid bid submission data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenderId);
    const tender = await prisma.tender.findFirst({
      where: isUuid ? { OR: [{ id: tenderId }, { tenderNumber: tenderId }] } : { tenderNumber: tenderId },
    });

    if (!tender) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }

    if (tender.status !== TenderStatus.PUBLISHED) {
      return res.status(400).json({
        success: false,
        error: { code: 'TENDER_NOT_OPEN', message: `Bidding is closed for this tender (status: ${tender.status}).` },
      });
    }

    if (new Date() > new Date(tender.submissionDeadline)) {
      return res.status(400).json({
        success: false,
        error: { code: 'DEADLINE_EXPIRED', message: 'The submission deadline for this tender has passed.' },
      });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id: req.user.contractorId },
    });

    // Server-side eligibility re-validation
    const eligibility = evaluateContractorEligibility(tender, contractor);
    if (!eligibility.isEligible) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INELIGIBLE_CONTRACTOR',
          message: 'Contractor does not meet the eligibility requirements for this tender.',
          details: { reasons: eligibility.reasons },
        },
      });
    }

    // Check for duplicate submission
    const existingBid = await prisma.tenderBid.findFirst({
      where: {
        tenderId: tender.id,
        contractorId: req.user.contractorId,
      },
    });

    if (existingBid) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_BID',
          message: 'Your organization has already submitted a bid for this tender. Duplicate bids are prohibited.',
        },
      });
    }

    const { bidAmount, proposedDurationDays, technicalProposal, methodology, declarationAccepted } = parseResult.data;

    // Atomically create bid
    const year = new Date().getFullYear();
    const bidNumber = await generateUniqueBidNumber(prisma, year);

    const newBid = await prisma.tenderBid.create({
      data: {
        bidNumber,
        tenderId: tender.id,
        contractorId: req.user.contractorId,
        submittedById: req.user.id,
        bidAmount,
        proposedDurationDays,
        technicalProposal,
        methodology: methodology || null,
        declarationAccepted,
        status: BidStatus.SUBMITTED,
      },
    });

    // Notify publishing official
    await prisma.notification.create({
      data: {
        userId: tender.createdById,
        type: NotificationType.BID_SUBMITTED,
        title: 'New Tender Bid Submitted',
        message: `Contractor submitted bid ${newBid.bidNumber} for tender ${tender.tenderNumber}.`,
        entityType: 'TENDER',
        entityId: tender.id,
        actionUrl: `/admin/tenders/${tender.id}`,
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        entityType: 'TENDER_BID',
        entityId: newBid.id,
        action: 'BID_SUBMITTED',
        actorId: req.user.id,
        details: { tenderNumber: tender.tenderNumber, bidNumber: newBid.bidNumber, bidAmount },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Bid submitted successfully.',
      data: { bid: newBid },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/tenders/:id/bids
 * Officials review bids submitted for a tender (private bids hidden from other contractors)
 */
export async function getTenderBids(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized officials and admins may inspect competitive bids.' },
      });
    }

    const { id } = req.params;
    if (!isValidUuid(id)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }
    const bids = await prisma.tenderBid.findMany({
      where: { tenderId: id },
      include: {
        contractor: {
          select: {
            id: true,
            name: true,
            registrationNumber: true,
            licenseClass: true,
            isVerified: true,
            status: true,
            phone: true,
            email: true,
          },
        },
        submittedBy: {
          select: { id: true, name: true, email: true },
        },
        evaluatedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { bidAmount: 'asc' }, // Standard procurement ordering by bid amount
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
 * POST /api/tenders/:id/bids/:bidId/evaluate
 * Record official technical and financial evaluation notes
 */
export async function evaluateBid(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized to evaluate bids.' },
      });
    }

    const { id: tenderId, bidId } = req.params;
    if (!isValidUuid(tenderId) || !isValidUuid(bidId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender or bid not found.' } });
    }
    const parseResult = evaluateBidSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid evaluation data.',
        },
      });
    }

    const { decision, status, evaluationNotes } = parseResult.data;

    const bid = await prisma.tenderBid.findFirst({
      where: { id: bidId, tenderId },
      include: { contractor: true },
    });

    if (!bid) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Bid not found for this tender.' } });
    }

    const newStatus = status === 'UNDER_REVIEW' || decision === 'ACCEPT' ? BidStatus.UNDER_REVIEW : BidStatus.REJECTED;

    const updatedBid = await prisma.tenderBid.update({
      where: { id: bidId },
      data: {
        status: newStatus,
        officialEvaluationNotes: evaluationNotes,
        evaluatedById: req.user.id,
        evaluatedAt: new Date(),
      },
    });

    // Notify bidder
    await prisma.notification.create({
      data: {
        userId: bid.submittedById,
        type: NotificationType.BID_EVALUATED,
        title: 'Tender Bid Evaluation Update',
        message: `Your bid ${bid.bidNumber} has been reviewed by the evaluation committee.`,
        entityType: 'TENDER_BID',
        entityId: bid.id,
        actionUrl: `/contractor/workspace?tab=bids`,
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        entityType: 'TENDER_BID',
        entityId: bid.id,
        action: 'BID_EVALUATED',
        actorId: req.user.id,
        details: { decision, notes: evaluationNotes },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Bid evaluation recorded successfully.',
      data: { bid: updatedBid },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/tenders/:id/award
 * Officially award tender to winning contractor, generating WorkOrder & Milestones atomically
 */
export async function awardTender(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only authorized officials and administrators may award contracts.' },
      });
    }

    const { id: tenderId } = req.params;
    if (!isValidUuid(tenderId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }
    const parseResult = awardTenderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parseResult.error.issues[0]?.message || 'Invalid award request.',
        },
      });
    }

    const targetBidId = parseResult.data.winningBidId || parseResult.data.bidId;
    if (!targetBidId || !isValidUuid(targetBidId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Selected bid does not exist for this tender.' } });
    }
    const remarks = parseResult.data.awardJustification || parseResult.data.remarks || 'Officially awarded to evaluated bidder.';
    const { startDate, expectedCompletionDate } = parseResult.data;

    const tender = await prisma.tender.findUnique({
      where: { id: tenderId },
      include: { civicWork: true },
    });

    if (!tender) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tender not found.' } });
    }

    if (tender.status === TenderStatus.AWARDED) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_AWARDED', message: 'This tender has already been awarded.' },
      });
    }

    const winningBid = await prisma.tenderBid.findFirst({
      where: { id: targetBidId, tenderId: tender.id },
      include: { contractor: true },
    });

    if (!winningBid) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Selected bid does not exist for this tender.' },
      });
    }

    if (winningBid.status === BidStatus.REJECTED || winningBid.status === BidStatus.WITHDRAWN) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_BID_STATUS', message: 'Cannot award tender to a rejected or withdrawn bid.' },
      });
    }

    // Interactive transaction for atomic contract generation
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update winning bid
      await tx.tenderBid.update({
        where: { id: winningBid.id },
        data: {
          status: BidStatus.ACCEPTED,
          officialEvaluationNotes: remarks || winningBid.officialEvaluationNotes,
          evaluatedById: req.user!.id,
          evaluatedAt: new Date(),
        },
      });

      // 2. Reject other bids for this tender
      await tx.tenderBid.updateMany({
        where: {
          tenderId: tender.id,
          id: { not: winningBid.id },
        },
        data: {
          status: BidStatus.REJECTED,
          officialEvaluationNotes: 'Competitive bid process concluded; tender awarded to responsive evaluated bidder.',
        },
      });

      // 3. Mark tender as AWARDED
      const updatedTender = await tx.tender.update({
        where: { id: tender.id },
        data: {
          status: TenderStatus.AWARDED,
          awardedBidId: winningBid.id,
        },
      });

      // 4. Create or link CivicWork if needed
      let civicWorkId = tender.civicWorkId;
      if (!civicWorkId) {
        const year = new Date().getFullYear();
        const cwCount = await tx.civicWork.count();
        const workNumber = `CW-${year}-${String(cwCount + 1).padStart(4, '0')}`;

        const newCivicWork = await tx.civicWork.create({
          data: {
            workOrderNumber: workNumber,
            title: tender.title,
            description: tender.description,
            workType: tender.categoryCode,
            departmentId: tender.departmentId,
            location: tender.location,
            ward: tender.ward || null,
            estimatedBudget: tender.estimatedBudget,
            sanctionedAmount: winningBid.bidAmount,
            workStatus: 'IN_PROGRESS',
          },
        });
        civicWorkId = newCivicWork.id;
      } else {
        await tx.civicWork.update({
          where: { id: civicWorkId },
          data: {
            sanctionedAmount: winningBid.bidAmount,
            workStatus: 'IN_PROGRESS',
          },
        });
      }

      // 5. Generate WorkOrder
      const year = new Date().getFullYear();
      const workOrderNumber = await generateUniqueWorkOrderNumber(tx, year);

      const workOrder = await tx.workOrder.create({
        data: {
          workOrderNumber,
          civicWorkId,
          contractorId: winningBid.contractorId,
          tenderId: tender.id,
          tenderBidId: winningBid.id,
          contractAmount: winningBid.bidAmount,
          startDate: startDate ? new Date(startDate) : new Date(),
          expectedCompletionDate: expectedCompletionDate
            ? new Date(expectedCompletionDate)
            : new Date(Date.now() + (winningBid.proposedDurationDays || 30) * 86400000),
          executionStatus: ExecutionStatus.AWARDED,
        },
      });

      // 6. Pre-generate default structured project milestones
      const totalAmount = Number(winningBid.bidAmount);
      await tx.contractMilestone.createMany({
        data: [
          {
            workOrderId: workOrder.id,
            milestoneNumber: 1,
            title: 'Site Mobilization & Material Ingestion',
            description: 'Site possession, barrier installation, material safety test reports, and baseline level surveys.',
            targetPhysicalPercentage: 25.0,
            targetAmount: (totalAmount * 0.25).toFixed(2),
            status: 'PENDING',
          },
          {
            workOrderId: workOrder.id,
            milestoneNumber: 2,
            title: 'Primary Structural Execution',
            description: 'Major construction/resurfacing/pipe-laying milestones as specified in technical schedules.',
            targetPhysicalPercentage: 70.0,
            targetAmount: (totalAmount * 0.45).toFixed(2),
            status: 'PENDING',
          },
          {
            workOrderId: workOrder.id,
            milestoneNumber: 3,
            title: 'Final Finishing, Punch List & Quality Handover',
            description: 'Site cleanup, road markings/fixtures, joint sealing, and formal site inspection sign-off.',
            targetPhysicalPercentage: 100.0,
            targetAmount: (totalAmount * 0.30).toFixed(2),
            status: 'PENDING',
          },
        ],
      });

      return { tender: updatedTender, workOrder };
    });

    // Notify winning contractor
    await prisma.notification.create({
      data: {
        userId: winningBid.submittedById,
        type: NotificationType.CONTRACT_AWARDED,
        title: 'Contract Awarded!',
        message: `Congratulations! Your bid ${winningBid.bidNumber} has been awarded for tender ${tender.tenderNumber}. Work Order ${result.workOrder.workOrderNumber} is now active.`,
        entityType: 'WORK_ORDER',
        entityId: result.workOrder.id,
        actionUrl: `/contractor/workspace?tab=contracts`,
      },
    });

    // Audit log
    await prisma.auditEvent.create({
      data: {
        entityType: 'TENDER',
        entityId: tender.id,
        action: 'TENDER_AWARDED',
        actorId: req.user.id,
        details: {
          tenderNumber: tender.tenderNumber,
          winningBidNumber: winningBid.bidNumber,
          workOrderNumber: result.workOrder.workOrderNumber,
          contractAmount: String(winningBid.bidAmount),
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Tender officially awarded. Work order and contract execution milestones initialized.',
      data: result,
    });
  } catch (err) {
    return next(err);
  }
}
