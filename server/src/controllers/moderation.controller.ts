import type { Request, Response, NextFunction } from 'express';
import {
  ReportTargetType,
  AbuseReportStatus,
  ModerationCaseStatus,
  ModerationActionType,
  AppealStatus,
  UserRole,
  NotificationType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  createAbuseReportSchema,
  duplicateCheckQuerySchema,
  moderationActionSchema,
  createAppealSchema,
  reviewAppealSchema,
  userRestrictionSchema,
  liftRestrictionSchema,
  linkDuplicateSchema,
} from '../validation/moderation.validation.js';
import { findPotentialDuplicates } from '../lib/duplicateDetector.js';
import { evaluateModerationRisk } from '../lib/riskScoring.js';
import { RestrictionService } from '../lib/restrictionService.js';
import { NotificationService } from '../lib/notificationService.js';

/**
 * Generates collision-resistant unique tracking IDs for reports and cases
 */
function generateTrackingId(prefix: string): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${Date.now().toString().slice(-4)}${rand}`;
}

/**
 * Helper to fetch target content and identify content owner
 */
async function resolveTargetContent(targetType: ReportTargetType, targetId: string) {
  switch (targetType) {
    case ReportTargetType.COMPLAINT: {
      const complaint = await prisma.complaint.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          trackingId: true,
          title: true,
          description: true,
          citizenId: true,
          isModerated: true,
        },
      });
      return complaint
        ? {
            exists: true,
            ownerId: complaint.citizenId,
            snippet: complaint.title,
            isModerated: complaint.isModerated,
            raw: complaint,
          }
        : { exists: false };
    }
    case ReportTargetType.COMPLAINT_MESSAGE: {
      const msg = await prisma.complaintMessage.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          complaintId: true,
          senderId: true,
          message: true,
          isModerated: true,
        },
      });
      return msg
        ? {
            exists: true,
            ownerId: msg.senderId,
            snippet: msg.message.slice(0, 100),
            isModerated: msg.isModerated,
            raw: msg,
          }
        : { exists: false };
    }
    case ReportTargetType.PROPOSAL: {
      const proposal = await prisma.communityProposal.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          trackingId: true,
          title: true,
          description: true,
          submitterId: true,
          isModerated: true,
        },
      });
      return proposal
        ? {
            exists: true,
            ownerId: proposal.submitterId,
            snippet: proposal.title,
            isModerated: proposal.isModerated,
            raw: proposal,
          }
        : { exists: false };
    }
    case ReportTargetType.PROPOSAL_COMMENT: {
      const comment = await prisma.proposalComment.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          proposalId: true,
          authorId: true,
          content: true,
          isModerated: true,
        },
      });
      return comment
        ? {
            exists: true,
            ownerId: comment.authorId,
            snippet: comment.content.slice(0, 100),
            isModerated: comment.isModerated,
            raw: comment,
          }
        : { exists: false };
    }
    case ReportTargetType.POLL: {
      const poll = await prisma.publicPoll.findUnique({
        where: { id: targetId },
        select: { id: true, title: true, createdById: true },
      });
      return poll
        ? {
            exists: true,
            ownerId: poll.createdById,
            snippet: poll.title,
            isModerated: false,
            raw: poll,
          }
        : { exists: false };
    }
    case ReportTargetType.DOCUMENT: {
      const doc = await prisma.document.findUnique({
        where: { id: targetId },
        select: { id: true, fileName: true, uploaderId: true, isQuarantined: true },
      });
      return doc
        ? {
            exists: true,
            ownerId: doc.uploaderId,
            snippet: doc.fileName,
            isModerated: doc.isQuarantined,
            raw: doc,
          }
        : { exists: false };
    }
    default:
      return { exists: false };
  }
}

/**
 * 1. POST /api/moderation/reports
 * Citizen submits an abuse or policy violation report
 */
export async function submitAbuseReport(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = createAbuseReportSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid abuse report data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { targetType, targetId, reason, explanation } = parseResult.data;
    const reporterId = req.user?.id || null;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    // Verify target exists
    const targetInfo = await resolveTargetContent(targetType, targetId);
    if (!targetInfo.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'TARGET_NOT_FOUND',
          message: 'The content you are attempting to report does not exist.',
        },
      });
    }

    // Rate-check: Check if this user or IP submitted a report for this target recently
    if (reporterId) {
      const existingReport = await prisma.abuseReport.findFirst({
        where: {
          targetType,
          targetId,
          reporterId,
          status: { in: [AbuseReportStatus.PENDING, AbuseReportStatus.UNDER_REVIEW] },
        },
      });

      if (existingReport) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'DUPLICATE_REPORT',
            message: 'You have already submitted a report for this item. Our moderation team reviews every report in accordance with platform standards.',
          },
        });
      }
    }

    // Find or create ModerationCase for this target
    let modCase = await prisma.moderationCase.findFirst({
      where: {
        targetType,
        targetId,
        status: { in: [ModerationCaseStatus.OPEN, ModerationCaseStatus.UNDER_REVIEW] },
      },
      include: { reports: true },
    });

    const reportTrackingId = generateTrackingId('REP');

    if (!modCase) {
      const caseNumber = generateTrackingId('MOD');
      const triage = evaluateModerationRisk({
        reportCount: 1,
        distinctReporterCount: 1,
        reasons: [reason],
      });

      modCase = await prisma.moderationCase.create({
        data: {
          caseNumber,
          targetType,
          targetId,
          targetOwnerId: targetInfo.ownerId || null,
          status: ModerationCaseStatus.OPEN,
          priority: triage.priority,
          riskScore: triage.riskScore,
          riskFactors: triage.riskFactors,
        },
        include: { reports: true },
      });
    } else {
      // Re-evaluate case risk score with new report
      const allReasons = [...modCase.reports.map((r) => r.reason), reason];
      const distinctReporters = new Set(
        modCase.reports.map((r) => r.reporterId).filter(Boolean)
      );
      if (reporterId) distinctReporters.add(reporterId);

      const triage = evaluateModerationRisk({
        reportCount: modCase.reports.length + 1,
        distinctReporterCount: Math.max(1, distinctReporters.size),
        reasons: allReasons,
      });

      await prisma.moderationCase.update({
        where: { id: modCase.id },
        data: {
          riskScore: triage.riskScore,
          priority: triage.priority,
          riskFactors: triage.riskFactors,
        },
      });
    }

    // Create the AbuseReport
    const report = await prisma.abuseReport.create({
      data: {
        trackingId: reportTrackingId,
        targetType,
        targetId,
        reporterId,
        reason,
        explanation: explanation || null,
        caseId: modCase.id,
        ipAddress: ipAddress ? ipAddress.slice(0, 45) : null,
        status: AbuseReportStatus.PENDING,
      },
    });

    // Record audit event (with reporter details kept strictly internal)
    await prisma.auditEvent.create({
      data: {
        entityType: 'AbuseReport',
        entityId: report.id,
        action: 'ABUSE_REPORT_CREATED',
        actorId: reporterId,
        ipAddress: ipAddress ? ipAddress.slice(0, 45) : null,
        userAgent: req.headers['user-agent']?.slice(0, 255),
        details: {
          targetType,
          targetId,
          reason,
          caseNumber: modCase.caseNumber,
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Thank you for helping keep Civora safe. Your report has been securely registered and queued for human moderator review.',
      data: {
        trackingId: report.trackingId,
        targetType: report.targetType,
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. POST /api/moderation/duplicates/check
 * Pre-submission duplicate candidate checking for citizen complaint reports
 */
export async function checkDuplicateComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = duplicateCheckQuerySchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid duplicate check parameters.',
        },
      });
    }

    const candidates = await findPotentialDuplicates(parseResult.data);

    return res.status(200).json({
      success: true,
      data: {
        potentialDuplicatesFound: candidates.length > 0,
        candidates,
        guidance:
          candidates.length > 0
            ? 'Existing public reports have been found with similar details. Multiple citizen reports demonstrate community impact. If your issue is distinct or adds new evidence, you are encouraged to continue.'
            : 'No direct duplicate matches detected. You may proceed with your complaint.',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. GET /api/moderation/queue
 * Moderator Queue for staff (ADMIN and GOVERNMENT_OFFICIAL)
 */
export async function getModerationQueue(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff moderation authorization required.' },
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const skip = (page - 1) * limit;

    const statusParam = req.query.status as ModerationCaseStatus | undefined;
    const targetTypeParam = req.query.targetType as ReportTargetType | undefined;
    const priorityParam = req.query.priority as any;

    const where: Prisma.ModerationCaseWhereInput = {};
    if (statusParam && Object.values(ModerationCaseStatus).includes(statusParam)) {
      where.status = statusParam;
    }
    if (targetTypeParam && Object.values(ReportTargetType).includes(targetTypeParam)) {
      where.targetType = targetTypeParam;
    }
    if (priorityParam) {
      where.priority = priorityParam;
    }

    const [total, cases] = await Promise.all([
      prisma.moderationCase.count({ where }),
      prisma.moderationCase.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { riskScore: 'desc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { reports: true, actions: true, appeals: true } },
          reports: {
            take: 3,
            select: { id: true, reason: true, explanation: true, createdAt: true },
          },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: cases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. GET /api/moderation/cases/:id
 * Retrieve comprehensive moderation case detail
 */
export async function getModerationCaseDetails(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff moderation authorization required.' },
      });
    }

    const id = String(req.params.id);

    const modCase = await prisma.moderationCase.findUnique({
      where: { id },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            trackingId: true,
            reason: true,
            explanation: true,
            status: true,
            createdAt: true,
            // Shield reporter PII: do NOT include email or personal phone to prevent retaliation
            reporter: { select: { id: true, role: true } },
          },
        },
        actions: {
          orderBy: { createdAt: 'desc' },
          include: {
            moderator: { select: { id: true, name: true, role: true } },
          },
        },
        appeals: {
          orderBy: { createdAt: 'desc' },
          include: {
            appellant: { select: { id: true, name: true } },
            reviewer: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!modCase) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Moderation case not found.' },
      });
    }

    // Resolve target content details
    const targetContent = await resolveTargetContent(modCase.targetType, modCase.targetId);

    return res.status(200).json({
      success: true,
      data: {
        ...modCase,
        targetContent,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. POST /api/moderation/cases/:id/action
 * Apply a reason-based moderation action (rejection, removal, warning, restriction, restoration)
 */
export async function applyModerationAction(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff moderation authorization required.' },
      });
    }

    const caseId = String(req.params.id);
    const parseResult = moderationActionSchema.safeParse({ ...req.body, caseId });

    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid moderation action parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { actionType, reason, internalNotes } = parseResult.data;

    const modCase = await prisma.moderationCase.findUnique({
      where: { id: caseId },
    });

    if (!modCase) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Moderation case not found.' },
      });
    }

    const targetInfo = await resolveTargetContent(modCase.targetType, modCase.targetId);

    // Consequential updates based on actionType
    await prisma.$transaction(async (tx) => {
      // 1. Update target content moderation flag if applicable
      if (actionType === ModerationActionType.CONTENT_HIDDEN || actionType === ModerationActionType.CONTENT_REMOVED) {
        if (modCase.targetType === ReportTargetType.COMPLAINT) {
          await tx.complaint.update({
            where: { id: modCase.targetId },
            data: { isModerated: true, moderationReason: reason },
          });
        } else if (modCase.targetType === ReportTargetType.COMPLAINT_MESSAGE) {
          await tx.complaintMessage.update({
            where: { id: modCase.targetId },
            data: { isModerated: true, moderationReason: reason },
          });
        } else if (modCase.targetType === ReportTargetType.PROPOSAL) {
          await tx.communityProposal.update({
            where: { id: modCase.targetId },
            data: { isModerated: true, internalModerationNotes: reason },
          });
        } else if (modCase.targetType === ReportTargetType.PROPOSAL_COMMENT) {
          await tx.proposalComment.update({
            where: { id: modCase.targetId },
            data: { isModerated: true, moderationReason: reason },
          });
        } else if (modCase.targetType === ReportTargetType.DOCUMENT) {
          await tx.document.update({
            where: { id: modCase.targetId },
            data: { isQuarantined: true, quarantineReason: reason },
          });
        }
      } else if (actionType === ModerationActionType.CONTENT_RESTORED) {
        if (modCase.targetType === ReportTargetType.COMPLAINT) {
          await tx.complaint.update({
            where: { id: modCase.targetId },
            data: { isModerated: false, moderationReason: null },
          });
        } else if (modCase.targetType === ReportTargetType.COMPLAINT_MESSAGE) {
          await tx.complaintMessage.update({
            where: { id: modCase.targetId },
            data: { isModerated: false, moderationReason: null },
          });
        } else if (modCase.targetType === ReportTargetType.PROPOSAL) {
          await tx.communityProposal.update({
            where: { id: modCase.targetId },
            data: { isModerated: false },
          });
        } else if (modCase.targetType === ReportTargetType.PROPOSAL_COMMENT) {
          await tx.proposalComment.update({
            where: { id: modCase.targetId },
            data: { isModerated: false, moderationReason: null },
          });
        } else if (modCase.targetType === ReportTargetType.DOCUMENT) {
          await tx.document.update({
            where: { id: modCase.targetId },
            data: { isQuarantined: false, quarantineReason: null },
          });
        }
      }

      // 2. Create ModerationAction log record
      await tx.moderationAction.create({
        data: {
          caseId: modCase.id,
          moderatorId: req.user!.id,
          actionType,
          reason,
          internalNotes: internalNotes || null,
          targetSnapshot: targetInfo.exists ? (targetInfo.raw as any) : null,
        },
      });

      // 3. Update ModerationCase status
      const newCaseStatus =
        actionType === ModerationActionType.NO_ACTION
          ? ModerationCaseStatus.RESOLVED_NO_VIOLATION
          : ModerationCaseStatus.ACTION_TAKEN;

      await tx.moderationCase.update({
        where: { id: modCase.id },
        data: {
          status: newCaseStatus,
          assignedModeratorId: req.user!.id,
          internalNotes: internalNotes || modCase.internalNotes,
        },
      });

      // 4. Update associated AbuseReports
      const reportStatus =
        actionType === ModerationActionType.NO_ACTION
          ? AbuseReportStatus.RESOLVED_NO_VIOLATION
          : AbuseReportStatus.RESOLVED_ACTION_TAKEN;

      await tx.abuseReport.updateMany({
        where: { caseId: modCase.id },
        data: {
          status: reportStatus,
          reviewedAt: new Date(),
          assignedModeratorId: req.user!.id,
          resolutionNotes: reason,
        },
      });

      // 5. Create immutable audit log
      await tx.auditEvent.create({
        data: {
          entityType: 'ModerationCase',
          entityId: modCase.id,
          action: `MODERATION_${actionType}`,
          actorId: req.user!.id,
          ipAddress: req.ip || null,
          details: {
            caseNumber: modCase.caseNumber,
            targetType: modCase.targetType,
            targetId: modCase.targetId,
            actionType,
            reason,
          },
        },
      });
    });

    // 6. Notify content owner (if identifiable) without revealing reporter identity
    if (targetInfo.ownerId && actionType !== ModerationActionType.NO_ACTION) {
      try {
        await NotificationService.sendNotification({
          userId: targetInfo.ownerId,
          type:
            actionType === ModerationActionType.CONTENT_RESTORED
              ? NotificationType.CONTENT_MODERATED
              : NotificationType.MODERATION_WARNING,
          title: `Civic Content Moderation Notice: ${actionType.replace(/_/g, ' ')}`,
          message: `A moderation decision was made regarding your submitted ${modCase.targetType.toLowerCase().replace(/_/g, ' ')}. Action: ${actionType.replace(/_/g, ' ')}. Reason: ${reason}. If you believe this action was made in error, you may submit a formal appeal.`,
          actionUrl: '/notifications',
        });
      } catch {
        // Continue even if notification delivery encounters an issue
      }
    }

    return res.status(200).json({
      success: true,
      message: `Moderation action (${actionType}) successfully executed and recorded.`,
      data: {
        caseId: modCase.id,
        actionType,
        reason,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 6. POST /api/moderation/appeals
 * Citizen submits an appeal against a consequential moderation decision
 */
export async function submitAppeal(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to submit an appeal.' },
      });
    }

    const parseResult = createAppealSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid appeal data.',
        },
      });
    }

    const { caseId, reason } = parseResult.data;

    const modCase = await prisma.moderationCase.findUnique({
      where: { id: caseId },
    });

    if (!modCase) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Moderation case not found.' },
      });
    }

    // Citizen authorization check: Must be the content owner or an affected citizen
    if (modCase.targetOwnerId && modCase.targetOwnerId !== req.user.id && req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only appeal moderation decisions regarding your own submitted civic content.',
        },
      });
    }

    // Check for existing pending appeal
    const existingAppeal = await prisma.moderationAppeal.findFirst({
      where: {
        caseId,
        appellantId: req.user.id,
        status: { in: [AppealStatus.PENDING, AppealStatus.UNDER_REVIEW] },
      },
    });

    if (existingAppeal) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'APPEAL_ALREADY_PENDING',
          message: 'An appeal is already under formal review for this moderation case.',
        },
      });
    }

    const appeal = await prisma.moderationAppeal.create({
      data: {
        caseId,
        appellantId: req.user.id,
        reason,
        status: AppealStatus.PENDING,
      },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'ModerationAppeal',
        entityId: appeal.id,
        action: 'APPEAL_SUBMITTED',
        actorId: req.user.id,
        details: { caseId, caseNumber: modCase.caseNumber },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Your appeal has been registered and submitted for supervisory review.',
      data: appeal,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 7. POST /api/moderation/appeals/:id/review
 * Supervisory review of moderation appeal (Separation of duties)
 */
export async function reviewAppeal(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff authorization required to review appeals.' },
      });
    }

    const appealId = String(req.params.id);
    const parseResult = reviewAppealSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid appeal decision parameters.',
        },
      });
    }

    const { decision, decisionReason } = parseResult.data;

    const appeal = await prisma.moderationAppeal.findUnique({
      where: { id: appealId },
      include: {
        case: {
          include: {
            actions: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });

    if (!appeal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Appeal record not found.' },
      });
    }

    // Separation of Duties: Ensure reviewer is not the same moderator who enacted the original penalty
    const originalModeratorId = appeal.case.actions[0]?.moderatorId;
    if (
      originalModeratorId &&
      originalModeratorId === req.user.id &&
      req.user.role !== UserRole.ADMIN
    ) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SEPARATION_OF_DUTIES_VIOLATION',
          message: 'An appeal cannot be adjudicated by the same official who imposed the original moderation action. Another supervisor or admin must review it.',
        },
      });
    }

    const updatedAppeal = await prisma.$transaction(async (tx) => {
      const updated = await tx.moderationAppeal.update({
        where: { id: appealId },
        data: {
          status: decision as AppealStatus,
          reviewerId: req.user!.id,
          decisionReason,
          reviewedAt: new Date(),
        },
      });

      // If appeal is UPHELD (citizen's appeal is accepted/granted), restore the content!
      if (decision === AppealStatus.UPHELD) {
        const modCase = appeal.case;
        if (modCase.targetType === ReportTargetType.COMPLAINT) {
          await tx.complaint.update({
            where: { id: modCase.targetId },
            data: { isModerated: false, moderationReason: null },
          });
        } else if (modCase.targetType === ReportTargetType.COMPLAINT_MESSAGE) {
          await tx.complaintMessage.update({
            where: { id: modCase.targetId },
            data: { isModerated: false, moderationReason: null },
          });
        } else if (modCase.targetType === ReportTargetType.PROPOSAL) {
          await tx.communityProposal.update({
            where: { id: modCase.targetId },
            data: { isModerated: false },
          });
        } else if (modCase.targetType === ReportTargetType.PROPOSAL_COMMENT) {
          await tx.proposalComment.update({
            where: { id: modCase.targetId },
            data: { isModerated: false, moderationReason: null },
          });
        } else if (modCase.targetType === ReportTargetType.DOCUMENT) {
          await tx.document.update({
            where: { id: modCase.targetId },
            data: { isQuarantined: false, quarantineReason: null },
          });
        }

        await tx.moderationAction.create({
          data: {
            caseId: modCase.id,
            moderatorId: req.user!.id,
            actionType: ModerationActionType.CONTENT_RESTORED,
            reason: `Appeal approved: ${decisionReason}`,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          entityType: 'ModerationAppeal',
          entityId: appeal.id,
          action: `APPEAL_DECIDED_${decision}`,
          actorId: req.user!.id,
          details: { decision, decisionReason },
        },
      });

      return updated;
    });

    // Notify appellant of decision
    try {
      await NotificationService.sendNotification({
        userId: appeal.appellantId,
        type: NotificationType.APPEAL_DECISION,
        title: `Moderation Appeal Decision: ${decision}`,
        message: `Your appeal regarding Case #${appeal.case.caseNumber} has been resolved: ${decision}. Details: ${decisionReason}`,
        actionUrl: '/notifications',
      });
    } catch {
      // Ignore notification failures
    }

    return res.status(200).json({
      success: true,
      message: `Appeal decision (${decision}) recorded successfully.`,
      data: updatedAppeal,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 8. POST /api/moderation/restrictions
 * Apply scoped restriction to a user account (Admin / Authorized Official)
 */
export async function applyUserRestriction(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Administrator authority required to apply account restrictions.' },
      });
    }

    const parseResult = userRestrictionSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid restriction data.',
        },
      });
    }

    const restriction = await RestrictionService.applyRestriction({
      ...parseResult.data,
      createdById: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Account restriction successfully applied.',
      data: restriction,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 9. POST /api/moderation/restrictions/:id/lift
 * Lift an active restriction
 */
export async function liftUserRestriction(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Administrator authority required to lift restrictions.' },
      });
    }

    const restrictionId = String(req.params.id);
    const parseResult = liftRestrictionSchema.safeParse(req.body);

    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid lift reason.',
        },
      });
    }

    const lifted = await RestrictionService.liftRestriction({
      restrictionId,
      liftedById: req.user.id,
      liftReason: parseResult.data.liftReason,
    });

    return res.status(200).json({
      success: true,
      message: 'Restriction successfully lifted.',
      data: lifted,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 10. POST /api/moderation/duplicates/link
 * Link related complaints as duplicate/shared incident without deleting records
 */
export async function linkDuplicateComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff authorization required to link duplicate complaints.' },
      });
    }

    const parseResult = linkDuplicateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid duplicate linking parameters.',
        },
      });
    }

    const { primaryComplaintId, duplicateComplaintId, reason } = parseResult.data;

    if (primaryComplaintId === duplicateComplaintId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_LINK_INVALID',
          message: 'A complaint cannot be linked as a duplicate of itself.',
        },
      });
    }

    const [primary, duplicate] = await Promise.all([
      prisma.complaint.findUnique({ where: { id: primaryComplaintId } }),
      prisma.complaint.findUnique({ where: { id: duplicateComplaintId } }),
    ]);

    if (!primary || !duplicate) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'COMPLAINTS_NOT_FOUND',
          message: 'One or both of the specified complaints do not exist.',
        },
      });
    }

    const link = await prisma.complaintDuplicateLink.upsert({
      where: {
        primaryComplaintId_duplicateComplaintId: {
          primaryComplaintId,
          duplicateComplaintId,
        },
      },
      create: {
        primaryComplaintId,
        duplicateComplaintId,
        reason: reason || 'Linked as related civic incident by municipal official.',
        linkedById: req.user.id,
      },
      update: {
        reason: reason || 'Updated duplicate relationship.',
        linkedById: req.user.id,
      },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'ComplaintDuplicateLink',
        entityId: link.id,
        action: 'COMPLAINT_DUPLICATE_LINKED',
        actorId: req.user.id,
        details: {
          primaryTrackingId: primary.trackingId,
          duplicateTrackingId: duplicate.trackingId,
          reason,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Complaints ${primary.trackingId} and ${duplicate.trackingId} successfully linked as related incident. Both submissions and tracking IDs remain valid.`,
      data: link,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 11. GET /api/moderation/metrics
 * Administrative aggregate abuse prevention and moderation statistics
 */
export async function getModerationMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Administrator authority required.' },
      });
    }

    const [
      totalReports,
      pendingReports,
      openCases,
      actionTakenCases,
      activeRestrictions,
      totalDuplicateLinks,
    ] = await Promise.all([
      prisma.abuseReport.count(),
      prisma.abuseReport.count({ where: { status: AbuseReportStatus.PENDING } }),
      prisma.moderationCase.count({ where: { status: ModerationCaseStatus.OPEN } }),
      prisma.moderationCase.count({ where: { status: ModerationCaseStatus.ACTION_TAKEN } }),
      prisma.userRestriction.count({ where: { isActive: true } }),
      prisma.complaintDuplicateLink.count(),
    ]);

    // Reason distribution
    const reasonGroups = await prisma.abuseReport.groupBy({
      by: ['reason'],
      _count: { reason: true },
    });

    const reasonDistribution = reasonGroups.map((g) => ({
      reason: g.reason,
      count: g._count.reason,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalReports,
        pendingReports,
        openCases,
        actionTakenCases,
        activeRestrictions,
        totalDuplicateLinks,
        reasonDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 12. GET /api/moderation/rules
 * Public civic platform content standards and moderation policy
 */
export async function getPlatformRules(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: {
      platform: 'Civora Civic Platform',
      version: '1.0',
      lastUpdated: '2026-10-18',
      principles: [
        'Proportionate and explainable moderation controls.',
        'Criticism of public authorities, government performance, and controversial civic issues is lawful democratic participation and is explicitly protected.',
        'No citizen is treated as fraudulent merely because their report is unusual, difficult to verify, or submitted repeatedly by community members.',
        'Duplicate reports help demonstrate community impact and are linked as related incidents without destructive deletion.',
        'All consequential moderation decisions require an explicit mandatory reason and provide transparent appeal recourse.',
      ],
      prohibitedContent: [
        {
          category: 'SPAM',
          description: 'Automated or machine-like flooding of complaints, comments, proposals, or votes.',
        },
        {
          category: 'HARASSMENT',
          description: 'Targeted personal attacks, threats of violence, or intimidation directed at citizens or public officials.',
        },
        {
          category: 'PERSONAL_DATA_EXPOSURE',
          description: 'Doxxing or exposing private phone numbers, home addresses, or financial data without consent.',
        },
        {
          category: 'IMPERSONATION',
          description: 'Misrepresenting identity as another citizen, municipal official, or government entity.',
        },
        {
          category: 'MALICIOUS_OR_SUSPICIOUS',
          description: 'Malicious links, exploit files, or deceptive submissions intended to disrupt municipal services.',
        },
      ],
      appealsProcess: {
        description: 'Any citizen whose content or account status is impacted by a moderation decision may file an appeal. Appeals are reviewed with strict separation of duties.',
      },
    },
  });
}
