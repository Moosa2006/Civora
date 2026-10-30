import {
  PrismaClient,
  ComplaintStatus,
  ComplaintPriority,
  SlaStatus,
  EscalationLevel,
  EscalationStatus,
  EscalationTrigger,
  UserRole,
} from '@prisma/client';
import { NotificationService } from './notificationService.js';

export class SlaEngine {
  /**
   * Deterministic SLA Policy Selector
   * Precedence:
   * 1. Active policy matching both categoryId and priority
   * 2. Active policy matching categoryId (priority null)
   * 3. Active policy matching priority (categoryId null)
   * 4. Active default policy (isDefault: true, categoryId null, priority null)
   * 5. Returns null if no match found
   */
  static async selectPolicyForComplaint(
    prisma: PrismaClient,
    categoryId?: string | null,
    priority?: ComplaintPriority | null
  ) {
    const now = new Date();

    // 1. Exact Category + Priority
    if (categoryId && priority) {
      const exactPolicy = await prisma.slaPolicy.findFirst({
        where: {
          categoryId,
          priority,
          isActive: true,
          effectiveStartDate: { lte: now },
          OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: now } }],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (exactPolicy) return exactPolicy;
    }

    // 2. Category match (General priority)
    if (categoryId) {
      const categoryPolicy = await prisma.slaPolicy.findFirst({
        where: {
          categoryId,
          priority: null,
          isActive: true,
          effectiveStartDate: { lte: now },
          OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: now } }],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (categoryPolicy) return categoryPolicy;
    }

    // 3. Priority match (General category)
    if (priority) {
      const priorityPolicy = await prisma.slaPolicy.findFirst({
        where: {
          categoryId: null,
          priority,
          isActive: true,
          effectiveStartDate: { lte: now },
          OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: now } }],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (priorityPolicy) return priorityPolicy;
    }

    // 4. Default policy fallback
    const defaultPolicy = await prisma.slaPolicy.findFirst({
      where: {
        isDefault: true,
        isActive: true,
        effectiveStartDate: { lte: now },
        OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return defaultPolicy || null;
  }

  /**
   * Calculates and attaches SLA to a complaint upon submission or review
   */
  static async calculateAndAttachSla(prisma: PrismaClient, complaintId: string) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { sla: true },
    });

    if (!complaint) return null;

    // If an SLA snapshot already exists, do not overwrite historical original deadlines
    if (complaint.sla) {
      return complaint.sla;
    }

    const policy = await this.selectPolicyForComplaint(
      prisma,
      complaint.categoryId,
      complaint.priority
    );

    const clockStartedAt = complaint.createdAt || new Date();

    if (!policy) {
      // Explicitly record that no SLA is configured for this complaint
      return await prisma.complaintSla.create({
        data: {
          complaintId: complaint.id,
          policyId: null,
          policyName: 'No Configured SLA Policy',
          responseTargetHours: 0,
          resolutionTargetHours: 0,
          clockStartedAt,
          originalResponseDeadline: clockStartedAt,
          originalResolutionDeadline: clockStartedAt,
          currentResponseDeadline: clockStartedAt,
          currentResolutionDeadline: clockStartedAt,
          slaStatus: SlaStatus.NO_SLA,
        },
      });
    }

    const responseTargetMs = policy.responseTargetHours * 60 * 60 * 1000;
    const resolutionTargetMs = policy.resolutionTargetHours * 60 * 60 * 1000;

    const originalResponseDeadline = new Date(clockStartedAt.getTime() + responseTargetMs);
    const originalResolutionDeadline = new Date(clockStartedAt.getTime() + resolutionTargetMs);

    return await prisma.complaintSla.create({
      data: {
        complaintId: complaint.id,
        policyId: policy.id,
        policyName: policy.name,
        responseTargetHours: policy.responseTargetHours,
        resolutionTargetHours: policy.resolutionTargetHours,
        clockStartedAt,
        originalResponseDeadline,
        originalResolutionDeadline,
        currentResponseDeadline: originalResponseDeadline,
        currentResolutionDeadline: originalResolutionDeadline,
        slaStatus: SlaStatus.ON_TRACK,
      },
    });
  }

  /**
   * Evaluates active SLA deadlines, warning thresholds, overdue states, and escalations
   */
  static async evaluateComplaintSla(prisma: PrismaClient, complaintId: string) {
    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      include: {
        sla: {
          include: { policy: true },
        },
        assignedDepartment: true,
        assignedOfficial: true,
        citizen: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        escalations: {
          where: {
            status: { in: [EscalationStatus.ACTIVE, EscalationStatus.ACKNOWLEDGED, EscalationStatus.ACTION_PLANNED] },
          },
        },
      },
    });

    if (!complaint || !complaint.sla) return null;

    const sla = complaint.sla;
    if (sla.slaStatus === SlaStatus.NO_SLA) return sla;

    const now = new Date();

    // Check if initial response has occurred
    // A response is recognized when reviewedAt, assignedAt, or first inspection/milestone exists
    let respondedAt = sla.respondedAt;
    if (!respondedAt) {
      if (complaint.reviewedAt) {
        respondedAt = complaint.reviewedAt;
      } else if (complaint.assignedAt) {
        respondedAt = complaint.assignedAt;
      } else if (
        complaint.status !== ComplaintStatus.SUBMITTED &&
        complaint.status !== ComplaintStatus.UNDER_REVIEW
      ) {
        respondedAt = complaint.updatedAt;
      }
    }

    const isResponseOverdue = !respondedAt && now > sla.currentResponseDeadline;

    // Check resolution state
    const isTerminalStatus =
      complaint.status === ComplaintStatus.RESOLVED ||
      complaint.status === ComplaintStatus.VERIFIED ||
      complaint.status === ComplaintStatus.CLOSED;

    let isResolutionOverdue = false;
    let nextSlaStatus: SlaStatus = SlaStatus.ON_TRACK;

    if (isTerminalStatus) {
      const resolutionTimestamp = complaint.resolvedAt || complaint.verifiedAt || complaint.closedAt || now;
      if (resolutionTimestamp <= sla.currentResolutionDeadline) {
        nextSlaStatus = SlaStatus.RESOLVED_ON_TIME;
      } else {
        nextSlaStatus = SlaStatus.RESOLVED_LATE;
        isResolutionOverdue = true;
      }
    } else if (complaint.status === ComplaintStatus.REJECTED) {
      // Rejections are final triage decisions; if rejected within response deadline, not overdue
      nextSlaStatus = SlaStatus.RESOLVED_ON_TIME;
    } else {
      // Complaint is currently active and open
      isResolutionOverdue = now > sla.currentResolutionDeadline;

      if (isResolutionOverdue) {
        nextSlaStatus = SlaStatus.RESOLUTION_OVERDUE;
      } else if (isResponseOverdue) {
        nextSlaStatus = SlaStatus.RESPONSE_OVERDUE;
      } else {
        // Warning threshold calculation
        const warningThresholdHours = sla.policy?.warningThresholdHours ?? 12;
        const warningThresholdMs = warningThresholdHours * 60 * 60 * 1000;
        const timeToResolutionDeadline = sla.currentResolutionDeadline.getTime() - now.getTime();
        const timeToResponseDeadline = !respondedAt
          ? sla.currentResponseDeadline.getTime() - now.getTime()
          : Infinity;

        if (timeToResolutionDeadline <= warningThresholdMs || timeToResponseDeadline <= warningThresholdMs) {
          nextSlaStatus = SlaStatus.APPROACHING_DEADLINE;
        } else {
          nextSlaStatus = SlaStatus.ON_TRACK;
        }
      }
    }

    // Warning notification dispatch (only once per complaint)
    let warningSentAt = sla.warningSentAt;
    if (nextSlaStatus === SlaStatus.APPROACHING_DEADLINE && !warningSentAt) {
      const hoursRemaining = Math.max(
        0,
        Math.round((sla.currentResolutionDeadline.getTime() - now.getTime()) / (60 * 60 * 1000))
      );
      await NotificationService.notifySlaWarning(complaint, hoursRemaining, 'RESOLUTION');
      warningSentAt = now;
    }

    // Breach notification dispatch (only once per breach)
    let breachNotificationSentAt = sla.breachNotificationSentAt;
    if ((isResponseOverdue || isResolutionOverdue) && !breachNotificationSentAt && !isTerminalStatus) {
      const hoursOverdue = Math.max(
        1,
        Math.round((now.getTime() - sla.currentResolutionDeadline.getTime()) / (60 * 60 * 1000))
      );
      await NotificationService.notifySlaBreach(complaint, isResolutionOverdue ? 'RESOLUTION' : 'RESPONSE', hoursOverdue);
      breachNotificationSentAt = now;
    }

    // Auto-escalation rule:
    // If resolution is overdue and active escalation does not exist, trigger LEVEL_2_SUPERVISOR escalation
    let newEscalationCreated = false;
    if (isResolutionOverdue && !isTerminalStatus) {
      const hasActiveResolutionEscalation = complaint.escalations.some(
        (e) => e.triggerReason === EscalationTrigger.RESOLUTION_DEADLINE_MISSED
      );

      if (!hasActiveResolutionEscalation) {
        const escalationThresholdHours = sla.policy?.escalationThresholdHours ?? 24;
        const overdueHours = (now.getTime() - sla.currentResolutionDeadline.getTime()) / (60 * 60 * 1000);

        if (overdueHours >= escalationThresholdHours) {
          const escalation = await prisma.complaintEscalation.create({
            data: {
              complaintId: complaint.id,
              escalationLevel: EscalationLevel.LEVEL_2_SUPERVISOR,
              triggerReason: EscalationTrigger.RESOLUTION_DEADLINE_MISSED,
              notes: `Automated SLA Escalation: Case resolution deadline (${sla.currentResolutionDeadline.toISOString()}) exceeded by ${Math.round(overdueHours)} hours. Case escalated to Department Supervisor for urgent operational review.`,
              status: EscalationStatus.ACTIVE,
              escalatedToDepartmentId: complaint.assignedDepartmentId,
              escalatedToOfficialId: null,
              isSystemGenerated: true,
            },
          });

          // Log action in escalation action logs
          await prisma.escalationActionLog.create({
            data: {
              escalationId: escalation.id,
              actorId: null,
              action: 'AUTO_ESCALATED_LEVEL_2',
              notes: `Automated escalation triggered after ${Math.round(overdueHours)} hours overdue.`,
            },
          });

          await NotificationService.notifyEscalationTriggered(complaint, escalation);
          newEscalationCreated = true;
        }
      }
    }

    // Update ComplaintSla record
    const updatedSla = await prisma.complaintSla.update({
      where: { id: sla.id },
      data: {
        respondedAt,
        isResponseOverdue,
        isResolutionOverdue,
        slaStatus: nextSlaStatus,
        warningSentAt,
        breachNotificationSentAt,
        lastEvaluatedAt: now,
      },
    });

    return {
      ...updatedSla,
      newEscalationCreated,
    };
  }

  /**
   * Batch evaluates all active, non-final complaints
   * Fully idempotent: can be triggered continuously without duplicate alerts
   */
  static async evaluateAllActiveComplaints(prisma: PrismaClient) {
    const activeComplaints = await prisma.complaint.findMany({
      where: {
        status: {
          notIn: [
            ComplaintStatus.RESOLVED,
            ComplaintStatus.VERIFIED,
            ComplaintStatus.CLOSED,
            ComplaintStatus.REJECTED,
          ],
        },
      },
      select: { id: true, sla: { select: { id: true } } },
    });

    let evaluatedCount = 0;
    let warningsSent = 0;
    let breachesDetected = 0;
    let escalationsCreated = 0;

    for (const comp of activeComplaints) {
      // Ensure SLA record is attached if missing
      if (!comp.sla) {
        await this.calculateAndAttachSla(prisma, comp.id);
      }

      const result = await this.evaluateComplaintSla(prisma, comp.id);
      if (result) {
        evaluatedCount++;
        if (result.slaStatus === SlaStatus.APPROACHING_DEADLINE && result.warningSentAt) {
          warningsSent++;
        }
        if (result.isResolutionOverdue || result.isResponseOverdue) {
          breachesDetected++;
        }
        if ((result as any).newEscalationCreated) {
          escalationsCreated++;
        }
      }
    }

    return {
      evaluatedCount,
      warningsSent,
      breachesDetected,
      escalationsCreated,
      evaluatedAt: new Date(),
    };
  }
}
