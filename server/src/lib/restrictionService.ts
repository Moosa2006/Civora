import { UserRestrictionType, AccountStatus, NotificationType } from '@prisma/client';
import { prisma } from './prisma.js';
import { NotificationService } from './notificationService.js';

export interface ApplyRestrictionInput {
  userId: string;
  restrictionType: UserRestrictionType;
  reason: string;
  durationHours?: number | null;
  createdById?: string;
}

export interface LiftRestrictionInput {
  restrictionId: string;
  liftedById: string;
  liftReason: string;
}

export class RestrictionService {
  /**
   * Retrieves all active restrictions for a user and automatically deactivates expired ones.
   */
  static async getUserActiveRestrictions(userId: string) {
    const now = new Date();

    // 1. Find all currently flagged as active
    const activeList = await prisma.userRestriction.findMany({
      where: {
        userId,
        isActive: true,
      },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
      },
    });

    const stillActive = [];

    // 2. Filter and auto-expire
    for (const res of activeList) {
      if (res.expiresAt && res.expiresAt < now) {
        await prisma.userRestriction.update({
          where: { id: res.id },
          data: {
            isActive: false,
            liftedAt: now,
            liftReason: 'Automatic expiration of temporary restriction window.',
          },
        });

        // If it was full account suspension, restore account status
        if (res.restrictionType === UserRestrictionType.ACCOUNT_SUSPENDED) {
          await prisma.user.update({
            where: { id: userId },
            data: { accountStatus: AccountStatus.ACTIVE },
          });
        }
      } else {
        stillActive.push(res);
      }
    }

    return stillActive;
  }

  /**
   * Checks whether a user has a specific active restriction.
   */
  static async hasActiveRestriction(
    userId: string,
    restrictionType: UserRestrictionType
  ): Promise<{ isRestricted: boolean; reason?: string; expiresAt?: Date | null }> {
    const active = await this.getUserActiveRestrictions(userId);
    const match = active.find(
      (r) =>
        r.restrictionType === restrictionType ||
        r.restrictionType === UserRestrictionType.ACCOUNT_SUSPENDED
    );

    if (match) {
      return {
        isRestricted: true,
        reason: match.reason,
        expiresAt: match.expiresAt,
      };
    }

    return { isRestricted: false };
  }

  /**
   * Applies a temporary or indefinite restriction to a user.
   */
  static async applyRestriction(input: ApplyRestrictionInput) {
    const expiresAt =
      input.durationHours && input.durationHours > 0
        ? new Date(Date.now() + input.durationHours * 60 * 60 * 1000)
        : null;

    const restriction = await prisma.$transaction(async (tx) => {
      const created = await tx.userRestriction.create({
        data: {
          userId: input.userId,
          restrictionType: input.restrictionType,
          reason: input.reason,
          expiresAt,
          isActive: true,
          createdById: input.createdById || null,
        },
      });

      if (input.restrictionType === UserRestrictionType.ACCOUNT_SUSPENDED) {
        await tx.user.update({
          where: { id: input.userId },
          data: { accountStatus: AccountStatus.SUSPENDED },
        });
      }

      await tx.auditEvent.create({
        data: {
          entityType: 'UserRestriction',
          entityId: created.id,
          action: 'RESTRICTION_APPLIED',
          actorId: input.createdById || null,
          details: {
            targetUserId: input.userId,
            restrictionType: input.restrictionType,
            reason: input.reason,
            expiresAt,
          },
        },
      });

      return created;
    });

    // Notify affected user with transparent reason and duration
    try {
      const durationMsg = expiresAt
        ? ` Active until ${expiresAt.toLocaleString()}.`
        : ' Indefinite restriction.';

      await NotificationService.sendNotification({
        userId: input.userId,
        type: NotificationType.ACCOUNT_RESTRICTED,
        title: 'Account Restriction Notice',
        message: `Your account has received a restriction (${input.restrictionType.replace(/_/g, ' ')}). Reason: ${input.reason}.${durationMsg} You may submit an appeal if you believe this was an error.`,
        actionUrl: '/settings/notifications',
      });
    } catch {
      // Ignore notification failures in tests
    }

    return restriction;
  }

  /**
   * Lifts an active restriction.
   */
  static async liftRestriction(input: LiftRestrictionInput) {
    const restriction = await prisma.userRestriction.findUnique({
      where: { id: input.restrictionId },
    });

    if (!restriction || !restriction.isActive) {
      throw new Error('Active restriction not found.');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.userRestriction.update({
        where: { id: input.restrictionId },
        data: {
          isActive: false,
          liftedAt: new Date(),
          liftedById: input.liftedById,
          liftReason: input.liftReason,
        },
      });

      if (restriction.restrictionType === UserRestrictionType.ACCOUNT_SUSPENDED) {
        await tx.user.update({
          where: { id: restriction.userId },
          data: { accountStatus: AccountStatus.ACTIVE },
        });
      }

      await tx.auditEvent.create({
        data: {
          entityType: 'UserRestriction',
          entityId: res.id,
          action: 'RESTRICTION_LIFTED',
          actorId: input.liftedById,
          details: {
            targetUserId: restriction.userId,
            restrictionType: restriction.restrictionType,
            liftReason: input.liftReason,
          },
        },
      });

      return res;
    });

    // Notify affected user
    try {
      await NotificationService.sendNotification({
        userId: restriction.userId,
        type: NotificationType.RESTRICTION_LIFTED,
        title: 'Account Restriction Lifted',
        message: `Your restriction (${restriction.restrictionType.replace(/_/g, ' ')}) has been lifted. Reason: ${input.liftReason}. Thank you for your patience.`,
        actionUrl: '/notifications',
      });
    } catch {
      // Ignore notification failures
    }

    return updated;
  }
}
