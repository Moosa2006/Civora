import type { Request, Response, NextFunction } from 'express';
import { ProposalStatus, UserRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { generateUniqueProposalTrackingId } from '../lib/trackingId.js';
import {
  createProposalSchema,
  proposalQuerySchema,
  moderateProposalSchema,
  officialResponseSchema,
  createCommentSchema,
} from '../validation/engagement.validation.js';
import { NotificationService } from '../lib/notificationService.js';

/**
 * 1. Submit a community proposal (Citizen)
 */
export async function createProposal(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to submit a proposal.' },
      });
    }

    const parseResult = createProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: firstIssue?.message || 'Invalid proposal data.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { title, description, categoryId, locality, problemStatement, suggestedSolution } = parseResult.data;

    // Verify category exists and is active
    const category = await prisma.complaintCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, departmentId: true, isActive: true },
    });

    if (!category || !category.isActive) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: 'The selected civic category does not exist or is inactive.',
        },
      });
    }

    const trackingId = await generateUniqueProposalTrackingId(prisma);

    const newProposal = await prisma.$transaction(async (tx) => {
      const proposal = await tx.communityProposal.create({
        data: {
          trackingId,
          title,
          description,
          categoryId,
          locality: locality || null,
          problemStatement: problemStatement || null,
          suggestedSolution: suggestedSolution || null,
          status: ProposalStatus.SUBMITTED,
          submitterId: req.user!.id,
        },
        include: {
          category: {
            select: { id: true, code: true, name: true, departmentId: true },
          },
          submitter: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'PROPOSAL',
          entityId: proposal.id,
          action: 'PROPOSAL_SUBMITTED',
          actorId: req.user!.id,
          details: { trackingId, title, categoryId },
        },
      });

      return proposal;
    });

    // Asynchronously notify submitter and staff
    await NotificationService.notifyProposalSubmitted(newProposal);

    return res.status(201).json({
      success: true,
      message: 'Community proposal submitted successfully and queued for moderation review.',
      data: {
        proposal: newProposal,
        trackingId: newProposal.trackingId,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Get published proposals for the public explorer
 */
export async function getPublicProposals(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = proposalQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { page, limit, categoryId, locality, search, sortBy } = parseResult.data;
    const skip = (page - 1) * limit;

    const where: Prisma.CommunityProposalWhereInput = {
      status: { in: [ProposalStatus.PUBLISHED, ProposalStatus.ACCEPTED_FOR_CONSIDERATION] },
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (locality) {
      where.locality = { contains: locality, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { trackingId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.CommunityProposalOrderByWithRelationInput =
      sortBy === 'most_supported' ? { supportCount: 'desc' } : { createdAt: 'desc' };

    const [total, proposals] = await Promise.all([
      prisma.communityProposal.count({ where }),
      prisma.communityProposal.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: { select: { id: true, code: true, name: true } },
          submitter: { select: { id: true, name: true, role: true } },
          officialResponseBy: { select: { id: true, name: true, role: true } },
          _count: { select: { supports: true, comments: true } },
        },
      }),
    ]);

    // Check if authenticated user has supported any of these proposals
    let userSupportedSet = new Set<string>();
    if (req.user) {
      const userSupports = await prisma.proposalSupport.findMany({
        where: {
          userId: req.user.id,
          proposalId: { in: proposals.map((p) => p.id) },
        },
        select: { proposalId: true },
      });
      userSupportedSet = new Set(userSupports.map((s) => s.proposalId));
    }

    const safeProposals = proposals.map((p) => ({
      id: p.id,
      trackingId: p.trackingId,
      title: p.title,
      description: p.description,
      problemStatement: p.problemStatement,
      suggestedSolution: p.suggestedSolution,
      locality: p.locality,
      status: p.status,
      category: p.category,
      submitter: { name: p.submitter.name, role: p.submitter.role },
      supportCount: p.supportCount,
      hasSupported: userSupportedSet.has(p.id),
      commentsCount: p._count.comments,
      officialResponse: p.officialResponse,
      officialResponseBy: p.officialResponseBy ? { name: p.officialResponseBy.name, role: p.officialResponseBy.role } : null,
      officialResponseAt: p.officialResponseAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      data: safeProposals,
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
 * 3. Get current authenticated citizen's submitted proposals (any status)
 */
export async function getMyProposals(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    const skip = (page - 1) * limit;

    const [total, proposals] = await Promise.all([
      prisma.communityProposal.count({ where: { submitterId: req.user.id } }),
      prisma.communityProposal.findMany({
        where: { submitterId: req.user.id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, code: true, name: true } },
          _count: { select: { supports: true, comments: true } },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: proposals,
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
 * 4. Get proposal detail by ID
 */
export async function getProposalById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const proposal = await prisma.communityProposal.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, code: true, name: true } },
        submitter: { select: { id: true, name: true, role: true } },
        officialResponseBy: { select: { id: true, name: true, role: true } },
        _count: { select: { supports: true, comments: true } },
      },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Community proposal not found.' },
      });
    }

    const isPubliclyVisible =
      proposal.status === ProposalStatus.PUBLISHED ||
      proposal.status === ProposalStatus.ACCEPTED_FOR_CONSIDERATION;

    const isOwner = req.user?.id === proposal.submitterId;
    const isStaff =
      req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.GOVERNMENT_OFFICIAL;

    // If not public, only owner or staff can view
    if (!isPubliclyVisible && !isOwner && !isStaff) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Community proposal not found.' },
      });
    }

    // Check if user has supported
    let hasSupported = false;
    if (req.user) {
      const support = await prisma.proposalSupport.findUnique({
        where: {
          proposalId_userId: { proposalId: proposal.id, userId: req.user.id },
        },
      });
      hasSupported = Boolean(support);
    }

    // Strip internal moderation notes unless staff
    const safeProposal = {
      id: proposal.id,
      trackingId: proposal.trackingId,
      title: proposal.title,
      description: proposal.description,
      problemStatement: proposal.problemStatement,
      suggestedSolution: proposal.suggestedSolution,
      locality: proposal.locality,
      status: proposal.status,
      category: proposal.category,
      submitter: { name: proposal.submitter.name, role: proposal.submitter.role },
      supportCount: proposal.supportCount,
      hasSupported,
      commentsCount: proposal._count.comments,
      publicExplanation: proposal.publicExplanation,
      officialResponse: proposal.officialResponse,
      officialResponseBy: proposal.officialResponseBy ? { name: proposal.officialResponseBy.name, role: proposal.officialResponseBy.role } : null,
      officialResponseAt: proposal.officialResponseAt,
      internalModerationNotes: isStaff ? proposal.internalModerationNotes : undefined,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    };

    return res.status(200).json({
      success: true,
      data: safeProposal,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Toggle community support (Citizen upvote)
 */
export async function toggleProposalSupport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to support proposals.' },
      });
    }

    const id = String(req.params.id);

    const proposal = await prisma.communityProposal.findUnique({
      where: { id },
      select: { id: true, status: true, title: true },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Community proposal not found.' },
      });
    }

    if (
      proposal.status !== ProposalStatus.PUBLISHED &&
      proposal.status !== ProposalStatus.ACCEPTED_FOR_CONSIDERATION
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROPOSAL_NOT_PUBLISHED',
          message: 'Only published proposals can receive community support.',
        },
      });
    }

    const existingSupport = await prisma.proposalSupport.findUnique({
      where: {
        proposalId_userId: { proposalId: id, userId: req.user.id },
      },
    });

    let supported = false;
    let newCount = 0;

    await prisma.$transaction(async (tx) => {
      if (existingSupport) {
        // Remove support
        await tx.proposalSupport.delete({
          where: { id: existingSupport.id },
        });
        const updated = await tx.communityProposal.update({
          where: { id },
          data: { supportCount: { decrement: 1 } },
          select: { supportCount: true },
        });
        supported = false;
        newCount = Math.max(0, updated.supportCount);
      } else {
        // Add support
        await tx.proposalSupport.create({
          data: { proposalId: id, userId: req.user!.id },
        });
        const updated = await tx.communityProposal.update({
          where: { id },
          data: { supportCount: { increment: 1 } },
          select: { supportCount: true },
        });
        supported = true;
        newCount = updated.supportCount;
      }
    });

    return res.status(200).json({
      success: true,
      message: supported ? 'Support recorded for this proposal.' : 'Support removed.',
      data: { supported, supportCount: newCount },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Get public comments on proposal
 */
export async function getProposalComments(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const comments = await prisma.proposalComment.findMany({
      where: { proposalId: id, isModerated: false },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    return res.status(200).json({
      success: true,
      data: comments.map((c) => ({
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: { name: c.author.name, role: c.author.role },
      })),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 7. Post comment on published proposal
 */
export async function createProposalComment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to post comments.' },
      });
    }

    const id = String(req.params.id);
    const parseResult = createCommentSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid comment content.',
        },
      });
    }

    const proposal = await prisma.communityProposal.findUnique({
      where: { id },
      select: { id: true, status: true, title: true, submitterId: true },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Community proposal not found.' },
      });
    }

    if (
      proposal.status !== ProposalStatus.PUBLISHED &&
      proposal.status !== ProposalStatus.ACCEPTED_FOR_CONSIDERATION
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROPOSAL_NOT_PUBLISHED',
          message: 'Comments can only be posted on published proposals.',
        },
      });
    }

    const comment = await prisma.proposalComment.create({
      data: {
        proposalId: id,
        authorId: req.user.id,
        content: parseResult.data.content,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Comment posted successfully.',
      data: {
        id: comment.id,
        content: comment.content,
        createdAt: comment.createdAt,
        author: { name: comment.author.name, role: comment.author.role },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 8. Staff / Admin moderation queue
 */
export async function getAdminProposalsQueue(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff moderation access required.' },
      });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const skip = (page - 1) * limit;

    const statusParam = req.query.status as string | undefined;
    const categoryId = req.query.categoryId as string | undefined;

    const where: Prisma.CommunityProposalWhereInput = {};
    if (statusParam && Object.values(ProposalStatus).includes(statusParam as ProposalStatus)) {
      where.status = statusParam as ProposalStatus;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [total, proposals] = await Promise.all([
      prisma.communityProposal.count({ where }),
      prisma.communityProposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, code: true, name: true } },
          submitter: { select: { id: true, name: true, email: true, role: true } },
          moderatedBy: { select: { id: true, name: true } },
          officialResponseBy: { select: { id: true, name: true } },
          _count: { select: { supports: true, comments: true } },
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: proposals,
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
 * 9. Moderate proposal status (Admin / Official)
 */
export async function moderateProposal(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff moderation access required.' },
      });
    }

    const id = String(req.params.id);
    const parseResult = moderateProposalSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid moderation parameters.',
        },
      });
    }

    const { status, internalNotes, publicExplanation } = parseResult.data;

    const proposal = await prisma.communityProposal.findUnique({
      where: { id },
      include: { submitter: { select: { id: true, name: true } } },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Community proposal not found.' },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.communityProposal.update({
        where: { id },
        data: {
          status,
          moderatedById: req.user!.id,
          moderatedAt: new Date(),
          internalModerationNotes: internalNotes || proposal.internalModerationNotes,
          publicExplanation: publicExplanation || proposal.publicExplanation,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'PROPOSAL',
          entityId: id,
          action: 'PROPOSAL_MODERATED',
          actorId: req.user!.id,
          details: { fromStatus: proposal.status, toStatus: status, internalNotes, publicExplanation },
        },
      });

      return result;
    });

    // Notify submitter of status change
    await NotificationService.notifyProposalStatusChanged({
      id: updated.id,
      trackingId: updated.trackingId,
      title: updated.title,
      submitterId: proposal.submitterId,
      status: updated.status,
      publicExplanation: updated.publicExplanation,
    });

    return res.status(200).json({
      success: true,
      message: `Proposal status updated to ${status}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 10. Post official authority response (Admin / Official)
 */
export async function addOfficialResponse(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff authority access required to post official responses.' },
      });
    }

    const id = String(req.params.id);
    const parseResult = officialResponseSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid official response content.',
        },
      });
    }

    const { officialResponse } = parseResult.data;

    const proposal = await prisma.communityProposal.findUnique({
      where: { id },
      select: { id: true, trackingId: true, title: true, submitterId: true, status: true },
    });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Community proposal not found.' },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.communityProposal.update({
        where: { id },
        data: {
          officialResponse,
          officialResponseById: req.user!.id,
          officialResponseAt: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'PROPOSAL',
          entityId: id,
          action: 'OFFICIAL_RESPONSE_POSTED',
          actorId: req.user!.id,
          details: { snippet: officialResponse.substring(0, 100) },
        },
      });

      return result;
    });

    // Notify submitter of official response
    await NotificationService.notifyProposalOfficialResponse({
      id: updated.id,
      trackingId: updated.trackingId,
      title: updated.title,
      submitterId: proposal.submitterId,
      officialResponse,
      responderName: req.user.name,
    });

    return res.status(200).json({
      success: true,
      message: 'Official authority response posted successfully.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}
