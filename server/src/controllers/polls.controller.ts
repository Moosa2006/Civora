import type { Request, Response, NextFunction } from 'express';
import { PollStatus, PollType, PollVisibilityRule, ProposalStatus, UserRole, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  createPollSchema,
  submitVoteSchema,
  updatePollStatusSchema,
} from '../validation/engagement.validation.js';
import { NotificationService } from '../lib/notificationService.js';

/**
 * Helper to determine if vote counts and percentages can be seen by the viewer
 */
function canViewResults(
  poll: {
    status: PollStatus;
    visibilityRule: PollVisibilityRule;
    endDate: Date;
  },
  user: { id: string; role: UserRole } | null | undefined,
  hasVoted: boolean
): boolean {
  if (user?.role === UserRole.ADMIN || user?.role === UserRole.GOVERNMENT_OFFICIAL) {
    return true;
  }

  const isClosed = poll.status === PollStatus.CLOSED || new Date() > poll.endDate;

  switch (poll.visibilityRule) {
    case PollVisibilityRule.ALWAYS_VISIBLE:
      return true;
    case PollVisibilityRule.AFTER_VOTE:
      return hasVoted || isClosed;
    case PollVisibilityRule.AFTER_CLOSE:
      return isClosed;
    default:
      return true;
  }
}

/**
 * 1. Get public polls
 */
export async function getPublicPolls(req: Request, res: Response, next: NextFunction) {
  try {
    const isStaff =
      req.user?.role === UserRole.ADMIN || req.user?.role === UserRole.GOVERNMENT_OFFICIAL;

    const where: Prisma.PublicPollWhereInput = isStaff
      ? {}
      : { status: { in: [PollStatus.OPEN, PollStatus.CLOSED] } };

    const statusParam = req.query.status as string | undefined;
    if (statusParam && Object.values(PollStatus).includes(statusParam as PollStatus)) {
      where.status = statusParam as PollStatus;
    }

    const polls = await prisma.publicPoll.findMany({
      where,
      orderBy: [{ status: 'asc' }, { endDate: 'desc' }],
      include: {
        category: { select: { id: true, code: true, name: true } },
        options: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { participations: true } },
      },
    });

    // Check which polls current authenticated user has voted in
    let userVotedPollIds = new Set<string>();
    if (req.user) {
      const participations = await prisma.pollParticipation.findMany({
        where: {
          userId: req.user.id,
          pollId: { in: polls.map((p) => p.id) },
        },
        select: { pollId: true },
      });
      userVotedPollIds = new Set(participations.map((p) => p.pollId));
    }

    const now = new Date();

    const formattedPolls = polls.map((poll) => {
      const hasVoted = userVotedPollIds.has(poll.id);
      const allowResults = canViewResults(poll, req.user, hasVoted);
      const isExpired = now > poll.endDate;

      return {
        id: poll.id,
        title: poll.title,
        question: poll.question,
        description: poll.description,
        category: poll.category,
        locality: poll.locality,
        status: poll.status === PollStatus.OPEN && isExpired ? PollStatus.CLOSED : poll.status,
        pollType: poll.pollType,
        maxSelections: poll.maxSelections,
        visibilityRule: poll.visibilityRule,
        startDate: poll.startDate,
        endDate: poll.endDate,
        isAdvisory: poll.isAdvisory,
        totalVotes: poll.totalVotes,
        participantCount: poll._count.participations,
        hasVoted,
        resultsVisible: allowResults,
        options: poll.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          orderIndex: opt.orderIndex,
          voteCount: allowResults ? opt.voteCount : undefined,
          percentage:
            allowResults && poll.totalVotes > 0
              ? Math.round((opt.voteCount / poll.totalVotes) * 100)
              : undefined,
        })),
        createdAt: poll.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedPolls,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Get poll detail by ID
 */
export async function getPollById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);

    const poll = await prisma.publicPoll.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, code: true, name: true } },
        options: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { participations: true } },
      },
    });

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Public civic poll not found.' },
      });
    }

    // Check participation
    let hasVoted = false;
    let votedOptionIds: string[] = [];

    if (req.user) {
      const participation = await prisma.pollParticipation.findUnique({
        where: { pollId_userId: { pollId: poll.id, userId: req.user.id } },
      });
      hasVoted = Boolean(participation);

      if (hasVoted) {
        const userVotes = await prisma.pollVote.findMany({
          where: { pollId: poll.id, userId: req.user.id },
          select: { optionId: true },
        });
        votedOptionIds = userVotes.map((v) => v.optionId);
      }
    }

    const allowResults = canViewResults(poll, req.user, hasVoted);
    const now = new Date();
    const isExpired = now > poll.endDate;
    const computedStatus = poll.status === PollStatus.OPEN && isExpired ? PollStatus.CLOSED : poll.status;

    const safePoll = {
      id: poll.id,
      title: poll.title,
      question: poll.question,
      description: poll.description,
      category: poll.category,
      locality: poll.locality,
      status: computedStatus,
      pollType: poll.pollType,
      maxSelections: poll.maxSelections,
      visibilityRule: poll.visibilityRule,
      startDate: poll.startDate,
      endDate: poll.endDate,
      isAdvisory: poll.isAdvisory,
      totalVotes: poll.totalVotes,
      participantCount: poll._count.participations,
      hasVoted,
      votedOptionIds,
      resultsVisible: allowResults,
      options: poll.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        orderIndex: opt.orderIndex,
        voteCount: allowResults ? opt.voteCount : undefined,
        percentage:
          allowResults && poll.totalVotes > 0
            ? Math.round((opt.voteCount / poll.totalVotes) * 100)
            : undefined,
      })),
      createdAt: poll.createdAt,
    };

    return res.status(200).json({
      success: true,
      data: safePoll,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Submit vote in a poll (Citizen)
 */
export async function submitPollVote(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to participate in polls.' },
      });
    }

    const id = String(req.params.id);
    const parseResult = submitVoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid vote options.',
        },
      });
    }

    const { optionIds } = parseResult.data;

    const poll = await prisma.publicPoll.findUnique({
      where: { id },
      include: { options: true },
    });

    if (!poll) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Public civic poll not found.' },
      });
    }

    const now = new Date();

    // Enforce poll state & schedule
    if (poll.status !== PollStatus.OPEN) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'POLL_NOT_OPEN',
          message: 'This poll is currently not open for voting.',
        },
      });
    }

    if (now < poll.startDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'POLL_NOT_STARTED',
          message: 'This poll has not started yet.',
        },
      });
    }

    if (now > poll.endDate) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'POLL_CLOSED',
          message: 'This poll has already reached its closing deadline.',
        },
      });
    }

    // Enforce single vs multi selection rules
    if (poll.pollType === PollType.SINGLE_CHOICE && optionIds.length !== 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SINGLE_CHOICE_VIOLATION',
          message: 'Single choice polls only permit exactly one option selection.',
        },
      });
    }

    if (poll.pollType === PollType.MULTI_CHOICE && optionIds.length > poll.maxSelections) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MAX_SELECTION_EXCEEDED',
          message: `You can select at most ${poll.maxSelections} option(s) for this poll.`,
        },
      });
    }

    // Verify all selected options belong to this poll
    const validOptionIds = new Set(poll.options.map((o) => o.id));
    for (const optId of optionIds) {
      if (!validOptionIds.has(optId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OPTION',
            message: 'One or more selected options do not belong to this poll.',
          },
        });
      }
    }

    // Concurrency-safe participation write
    try {
      await prisma.$transaction(async (tx) => {
        // 1. Record participation (Hard unique constraint on [pollId, userId])
        await tx.pollParticipation.create({
          data: {
            pollId: id,
            userId: req.user!.id,
          },
        });

        // 2. Record vote records
        for (const optId of optionIds) {
          await tx.pollVote.create({
            data: {
              pollId: id,
              userId: req.user!.id,
              optionId: optId,
            },
          });

          await tx.pollOption.update({
            where: { id: optId },
            data: { voteCount: { increment: 1 } },
          });
        }

        // 3. Update totalVotes on poll
        await tx.publicPoll.update({
          where: { id },
          data: { totalVotes: { increment: optionIds.length } },
        });
      });
    } catch (dbError: any) {
      // Prisma P2002: Unique constraint failed
      if (dbError.code === 'P2002') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'ALREADY_VOTED',
            message: 'You have already recorded your response in this poll. Multiple submissions are strictly prevented.',
          },
        });
      }
      throw dbError;
    }

    // Asynchronously notify user
    await NotificationService.notifyVoteRecorded(poll, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Your response has been securely recorded. Thank you for participating!',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Create new public poll (Admin / Official)
 */
export async function createPoll(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || (req.user.role !== UserRole.ADMIN && req.user.role !== UserRole.GOVERNMENT_OFFICIAL)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Staff authority required to create civic polls.' },
      });
    }

    const parseResult = createPollSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: issue?.message || 'Invalid poll configuration.',
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const {
      title,
      question,
      description,
      categoryId,
      locality,
      pollType,
      maxSelections,
      visibilityRule,
      startDate,
      endDate,
      options,
      isAdvisory,
    } = parseResult.data;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DATES',
          message: 'Poll end date must be strictly after the start date.',
        },
      });
    }

    // Check unique options
    const uniqueOptions = Array.from(new Set(options.map((o) => o.trim())));
    if (uniqueOptions.length < 2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DUPLICATE_OPTIONS',
          message: 'Poll requires at least 2 distinct, unique options.',
        },
      });
    }

    const now = new Date();
    let initialStatus: PollStatus = PollStatus.OPEN;
    if (start > now) {
      initialStatus = PollStatus.SCHEDULED;
    }

    const poll = await prisma.$transaction(async (tx) => {
      const createdPoll = await tx.publicPoll.create({
        data: {
          title,
          question,
          description: description || null,
          categoryId: categoryId || null,
          locality: locality || null,
          status: initialStatus,
          pollType,
          maxSelections,
          visibilityRule,
          startDate: start,
          endDate: end,
          isAdvisory,
          createdById: req.user!.id,
          options: {
            create: uniqueOptions.map((text, idx) => ({
              text,
              orderIndex: idx,
            })),
          },
        },
        include: {
          options: true,
          category: { select: { id: true, name: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'POLL',
          entityId: createdPoll.id,
          action: 'POLL_CREATED',
          actorId: req.user!.id,
          details: { title, pollType, optionsCount: uniqueOptions.length },
        },
      });

      return createdPoll;
    });

    return res.status(201).json({
      success: true,
      message: 'Civic poll created successfully.',
      data: poll,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Update poll status (Admin)
 */
export async function updatePollStatus(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Administrator access required to modify poll status.' },
      });
    }

    const id = String(req.params.id);
    const parseResult = updatePollStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid poll status.' },
      });
    }

    const { status } = parseResult.data;

    const poll = await prisma.publicPoll.findUnique({ where: { id } });
    if (!poll) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Public civic poll not found.' },
      });
    }

    const updated = await prisma.publicPoll.update({
      where: { id },
      data: { status },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'POLL',
        entityId: id,
        action: 'POLL_STATUS_UPDATED',
        actorId: req.user.id,
        details: { fromStatus: poll.status, toStatus: status },
      },
    });

    return res.status(200).json({
      success: true,
      message: `Poll status updated to ${status}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Get overall engagement analytics
 */
export async function getEngagementAnalytics(_req: Request, res: Response, next: NextFunction) {
  try {
    const [
      totalProposals,
      publishedProposals,
      acceptedProposals,
      proposalsWithResponse,
      totalSupports,
      totalPolls,
      openPolls,
      totalPollVotes,
      proposalsByCategory,
    ] = await Promise.all([
      prisma.communityProposal.count(),
      prisma.communityProposal.count({ where: { status: ProposalStatus.PUBLISHED } }),
      prisma.communityProposal.count({ where: { status: ProposalStatus.ACCEPTED_FOR_CONSIDERATION } }),
      prisma.communityProposal.count({ where: { officialResponse: { not: null } } }),
      prisma.proposalSupport.count(),
      prisma.publicPoll.count(),
      prisma.publicPoll.count({ where: { status: PollStatus.OPEN } }),
      prisma.pollParticipation.count(),
      prisma.communityProposal.groupBy({
        by: ['categoryId'],
        _count: { id: true },
        where: { status: { in: [ProposalStatus.PUBLISHED, ProposalStatus.ACCEPTED_FOR_CONSIDERATION] } },
      }),
    ]);

    // Fetch category names for distribution
    const categoryIds = proposalsByCategory
      .map((c) => c.categoryId)
      .filter((cid): cid is string => Boolean(cid));

    const categories = await prisma.complaintCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, code: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const categoryDistribution = proposalsByCategory.map((item) => ({
      categoryId: item.categoryId || '',
      categoryName: (item.categoryId ? categoryMap.get(item.categoryId) : undefined) || 'General Improvement',
      count: item._count.id,
    }));

    const publishedCount = await prisma.communityProposal.count({
      where: { status: { in: [ProposalStatus.PUBLISHED, ProposalStatus.ACCEPTED_FOR_CONSIDERATION] } },
    });

    const officialResponseRate =
      publishedCount > 0
        ? Math.round((proposalsWithResponse / publishedCount) * 100)
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalProposals,
        publishedProposals: publishedCount,
        acceptedProposals,
        proposalsWithResponse,
        officialResponseRate,
        totalSupports,
        totalPolls,
        openPolls,
        totalPollParticipants: totalPollVotes,
        categoryDistribution,
      },
    });
  } catch (error) {
    next(error);
  }
}
