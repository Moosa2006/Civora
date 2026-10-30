import {
  NotificationType,
  ComplaintStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from './prisma.js';

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailNotifications: false,
  statusChangeAlerts: true,
  progressUpdateAlerts: true,
  assignmentAlerts: true,
  messageAlerts: true,
  resolutionAlerts: true,
};

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  actionUrl?: string;
  deduplicateSeconds?: number;
}

export class NotificationService {
  /**
   * Retrieves notification preferences for a user with standard fallbacks
   */
  static async getUserPreferences(userId: string) {
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!pref) {
      return {
        userId,
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        isDefault: true,
      };
    }

    return {
      userId: pref.userId,
      emailNotifications: pref.emailNotifications,
      statusChangeAlerts: pref.statusChangeAlerts,
      progressUpdateAlerts: pref.progressUpdateAlerts,
      assignmentAlerts: pref.assignmentAlerts,
      messageAlerts: pref.messageAlerts,
      resolutionAlerts: pref.resolutionAlerts,
      isDefault: false,
    };
  }

  /**
   * Evaluates if a given notification type is enabled by the recipient's preferences
   */
  static isTypeEnabled(type: NotificationType, prefs: typeof DEFAULT_NOTIFICATION_PREFERENCES): boolean {
    switch (type) {
      case NotificationType.COMPLAINT_SUBMITTED:
      case NotificationType.STATUS_CHANGED:
        return prefs.statusChangeAlerts;
      case NotificationType.PROGRESS_UPDATE:
        return prefs.progressUpdateAlerts;
      case NotificationType.DEPARTMENT_ASSIGNED:
        return prefs.assignmentAlerts;
      case NotificationType.RESOLUTION_SUBMITTED:
      case NotificationType.RESOLUTION_VERIFIED:
      case NotificationType.COMPLAINT_REOPENED:
        return prefs.resolutionAlerts;
      case NotificationType.MESSAGE_RECEIVED:
        return prefs.messageAlerts;
      case NotificationType.PROPOSAL_SUBMITTED:
      case NotificationType.PROPOSAL_STATUS_CHANGED:
      case NotificationType.PROPOSAL_RESPONSE:
        return prefs.statusChangeAlerts;
      case NotificationType.POLL_CREATED:
      case NotificationType.PROJECT_UPDATE:
      case NotificationType.SYSTEM_ALERT:
      default:
        return true;
    }
  }

  /**
   * Core notification dispatcher with preference filtering and deduplication
   */
  static async sendNotification({
    userId,
    type,
    title,
    message,
    entityType,
    entityId,
    actionUrl,
    deduplicateSeconds = 15,
  }: CreateNotificationParams) {
    try {
      // 1. Fetch user preferences
      const prefs = await this.getUserPreferences(userId);

      // 2. Preference evaluation
      if (!this.isTypeEnabled(type, prefs)) {
        return null;
      }

      // 3. Deduplication check
      if (deduplicateSeconds > 0 && entityId) {
        const threshold = new Date(Date.now() - deduplicateSeconds * 1000);
        const existing = await prisma.notification.findFirst({
          where: {
            userId,
            type,
            entityId,
            createdAt: { gte: threshold },
          },
        });
        if (existing) {
          return existing;
        }
      }

      // 4. Create in-app notification record
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          entityType: entityType || null,
          entityId: entityId || null,
          actionUrl: actionUrl || null,
        },
      });

      // 5. External delivery hook (Email notification simulation if enabled)
      if (prefs.emailNotifications) {
        // Safe, non-blocking check
        const smtpHost = process.env.SMTP_HOST;
        if (!smtpHost) {
          // Log safe informational note without leaking credentials
          // External channel graceful fallback
        }
      }

      return notification;
    } catch (err) {
      // Never let notification generation break the primary business transaction
      console.error(`[NotificationService] Failed to send notification to user ${userId}:`, err);
      return null;
    }
  }

  // ==========================================
  // DOMAIN EVENT NOTIFICATION HELPERS
  // ==========================================

  /**
   * Triggered when citizen lodges a complaint
   */
  static async notifyComplaintSubmitted(complaint: {
    id: string;
    trackingId: string;
    title: string;
    citizenId: string | null;
  }) {
    if (!complaint.citizenId) return null;

    return this.sendNotification({
      userId: complaint.citizenId,
      type: NotificationType.COMPLAINT_SUBMITTED,
      title: `Complaint Lodged: ${complaint.trackingId}`,
      message: `Your civic complaint "${complaint.title}" has been registered successfully with tracking ID ${complaint.trackingId}.`,
      entityType: 'COMPLAINT',
      entityId: complaint.id,
      actionUrl: `/track?id=${complaint.trackingId}`,
    });
  }

  /**
   * Triggered when complaint status changes (e.g. UNDER_REVIEW, REJECTED, CLOSED)
   */
  static async notifyComplaintStatusChanged(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId: string | null;
      status: ComplaintStatus;
    },
    reasonOrRemarks?: string
  ) {
    if (!complaint.citizenId) return null;

    const remarksText = reasonOrRemarks ? ` Remarks: ${reasonOrRemarks}` : '';
    return this.sendNotification({
      userId: complaint.citizenId,
      type: NotificationType.STATUS_CHANGED,
      title: `Status Update: ${complaint.trackingId}`,
      message: `Status updated to ${complaint.status}.${remarksText}`,
      entityType: 'COMPLAINT',
      entityId: complaint.id,
      actionUrl: `/track?id=${complaint.trackingId}`,
    });
  }

  /**
   * Triggered when a complaint is assigned or reassigned to a department / official
   */
  static async notifyComplaintAssigned(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId: string | null;
      assignedDepartmentId: string | null;
      assignedOfficialId: string | null;
    },
    departmentName?: string,
    officialName?: string
  ) {
    const notifications = [];

    // 1. Notify the assigned official directly if specified
    if (complaint.assignedOfficialId) {
      const officialNotif = await this.sendNotification({
        userId: complaint.assignedOfficialId,
        type: NotificationType.DEPARTMENT_ASSIGNED,
        title: `Assigned: ${complaint.trackingId}`,
        message: `Complaint "${complaint.title}" has been assigned to you.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/official`,
      });
      notifications.push(officialNotif);
    } else if (complaint.assignedDepartmentId) {
      // If assigned to department without a specific official, notify department officials
      const deptOfficials = await prisma.user.findMany({
        where: {
          departmentId: complaint.assignedDepartmentId,
          role: UserRole.GOVERNMENT_OFFICIAL,
          accountStatus: 'ACTIVE',
        },
        select: { id: true },
        take: 5, // notify active departmental leads
      });

      for (const off of deptOfficials) {
        const notif = await this.sendNotification({
          userId: off.id,
          type: NotificationType.DEPARTMENT_ASSIGNED,
          title: `New Department Grievance: ${complaint.trackingId}`,
          message: `Complaint "${complaint.title}" has been assigned to your department.`,
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          actionUrl: `/official`,
        });
        notifications.push(notif);
      }
    }

    // 2. Notify the citizen that their issue has been assigned
    if (complaint.citizenId) {
      const recipientMsg = officialName
        ? `assigned to ${officialName} (${departmentName || 'Department'}).`
        : `assigned to ${departmentName || 'the responsible municipal department'}.`;

      const citizenNotif = await this.sendNotification({
        userId: complaint.citizenId,
        type: NotificationType.DEPARTMENT_ASSIGNED,
        title: `Department Assigned: ${complaint.trackingId}`,
        message: `Your complaint "${complaint.title}" has been ${recipientMsg}`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/track?id=${complaint.trackingId}`,
      });
      notifications.push(citizenNotif);
    }

    return notifications;
  }

  /**
   * Triggered when an official logs a public progress milestone
   */
  static async notifyProgressUpdate(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId: string | null;
    },
    updateTitle: string,
    stage: string
  ) {
    if (!complaint.citizenId) return null;

    return this.sendNotification({
      userId: complaint.citizenId,
      type: NotificationType.PROGRESS_UPDATE,
      title: `Progress Update: ${complaint.trackingId}`,
      message: `Progress reported on "${complaint.title}": "${updateTitle}" (${stage}).`,
      entityType: 'COMPLAINT',
      entityId: complaint.id,
      actionUrl: `/track?id=${complaint.trackingId}`,
    });
  }

  /**
   * Triggered when official marks complaint RESOLVED awaiting verification
   */
  static async notifyResolutionSubmitted(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId: string | null;
    },
    officialName?: string
  ) {
    if (!complaint.citizenId) return null;

    const fromText = officialName ? ` by ${officialName}` : '';
    return this.sendNotification({
      userId: complaint.citizenId,
      type: NotificationType.RESOLUTION_SUBMITTED,
      title: `Verification Required: ${complaint.trackingId}`,
      message: `The department has marked "${complaint.title}" as resolved${fromText}. Please inspect and confirm satisfactory resolution.`,
      entityType: 'COMPLAINT',
      entityId: complaint.id,
      actionUrl: `/track?id=${complaint.trackingId}`,
    });
  }

  /**
   * Triggered when citizen confirms satisfactory completion
   */
  static async notifyResolutionVerified(complaint: {
    id: string;
    trackingId: string;
    title: string;
    assignedOfficialId: string | null;
    assignedDepartmentId: string | null;
  }) {
    const recipients: string[] = [];
    if (complaint.assignedOfficialId) {
      recipients.push(complaint.assignedOfficialId);
    } else if (complaint.assignedDepartmentId) {
      const officials = await prisma.user.findMany({
        where: {
          departmentId: complaint.assignedDepartmentId,
          role: UserRole.GOVERNMENT_OFFICIAL,
          accountStatus: 'ACTIVE',
        },
        select: { id: true },
        take: 3,
      });
      recipients.push(...officials.map((o) => o.id));
    }

    for (const userId of recipients) {
      await this.sendNotification({
        userId,
        type: NotificationType.RESOLUTION_VERIFIED,
        title: `Resolution Verified: ${complaint.trackingId}`,
        message: `The citizen has verified the satisfactory resolution of "${complaint.title}".`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/official`,
      });
    }
  }

  /**
   * Triggered when citizen disputes resolution and reopens complaint
   */
  static async notifyComplaintReopened(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      assignedOfficialId: string | null;
      assignedDepartmentId: string | null;
    },
    reason: string
  ) {
    const recipients: string[] = [];
    if (complaint.assignedOfficialId) {
      recipients.push(complaint.assignedOfficialId);
    } else if (complaint.assignedDepartmentId) {
      const officials = await prisma.user.findMany({
        where: {
          departmentId: complaint.assignedDepartmentId,
          role: UserRole.GOVERNMENT_OFFICIAL,
          accountStatus: 'ACTIVE',
        },
        select: { id: true },
        take: 3,
      });
      recipients.push(...officials.map((o) => o.id));
    }

    for (const userId of recipients) {
      await this.sendNotification({
        userId,
        type: NotificationType.COMPLAINT_REOPENED,
        title: `Complaint Reopened: ${complaint.trackingId}`,
        message: `Citizen requested reopening for "${complaint.title}". Reason: ${reason}`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/official`,
      });
    }
  }

  /**
   * Triggered when a new message is posted on a complaint communication thread
   */
  static async notifyMessageReceived(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId: string | null;
      assignedOfficialId: string | null;
      assignedDepartmentId: string | null;
    },
    sender: {
      id: string;
      name: string;
      role: UserRole;
    },
    messageContent: string
  ) {
    const snippet =
      messageContent.length > 80 ? `${messageContent.substring(0, 77)}...` : messageContent;

    // If sender is the Citizen -> notify assigned official / department staff
    if (sender.role === UserRole.CITIZEN) {
      const recipients: string[] = [];
      if (complaint.assignedOfficialId) {
        recipients.push(complaint.assignedOfficialId);
      } else if (complaint.assignedDepartmentId) {
        const officials = await prisma.user.findMany({
          where: {
            departmentId: complaint.assignedDepartmentId,
            role: UserRole.GOVERNMENT_OFFICIAL,
            accountStatus: 'ACTIVE',
          },
          select: { id: true },
          take: 3,
        });
        recipients.push(...officials.map((o) => o.id));
      }

      for (const userId of recipients) {
        await this.sendNotification({
          userId,
          type: NotificationType.MESSAGE_RECEIVED,
          title: `Citizen Message: ${complaint.trackingId}`,
          message: `${sender.name} sent a message on "${complaint.title}": "${snippet}"`,
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          actionUrl: `/official`,
        });
      }
    } else {
      // If sender is an Official or Admin -> notify the Citizen
      if (complaint.citizenId && complaint.citizenId !== sender.id) {
        await this.sendNotification({
          userId: complaint.citizenId,
          type: NotificationType.MESSAGE_RECEIVED,
          title: `Department Message: ${complaint.trackingId}`,
          message: `${sender.name} (${sender.role === UserRole.ADMIN ? 'Administrator' : 'Department Official'}): "${snippet}"`,
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          actionUrl: `/track?id=${complaint.trackingId}`,
        });
      }
    }
  }

  /**
   * Dispatches notifications when a citizen submits a proposal
   */
  static async notifyProposalSubmitted(proposal: {
    id: string;
    trackingId: string;
    title: string;
    submitterId: string;
    category?: { name: string; departmentId?: string | null } | null;
  }) {
    // 1. Notify the citizen that their proposal was received and is under review
    await this.sendNotification({
      userId: proposal.submitterId,
      type: NotificationType.PROPOSAL_SUBMITTED,
      title: `Proposal Received: ${proposal.trackingId}`,
      message: `Your community proposal "${proposal.title}" has been submitted and is currently in the moderation review queue.`,
      entityType: 'PROPOSAL',
      entityId: proposal.id,
      actionUrl: `/engagement/proposals/${proposal.id}`,
    });

    // 2. Alert relevant staff/administrators
    const staff = await prisma.user.findMany({
      where: {
        role: { in: [UserRole.ADMIN, UserRole.GOVERNMENT_OFFICIAL] },
        accountStatus: 'ACTIVE',
      },
      select: { id: true },
      take: 3,
    });

    for (const member of staff) {
      if (member.id !== proposal.submitterId) {
        await this.sendNotification({
          userId: member.id,
          type: NotificationType.PROPOSAL_SUBMITTED,
          title: `New Proposal in Review Queue: ${proposal.trackingId}`,
          message: `A new community proposal "${proposal.title}" is awaiting moderation triage.`,
          entityType: 'PROPOSAL',
          entityId: proposal.id,
          actionUrl: `/engagement/proposals/${proposal.id}`,
        });
      }
    }
  }

  /**
   * Dispatches notifications when a proposal status is updated by a moderator
   */
  static async notifyProposalStatusChanged(proposal: {
    id: string;
    trackingId: string;
    title: string;
    submitterId: string;
    status: string;
    publicExplanation?: string | null;
  }) {
    let message = `Your community proposal "${proposal.title}" status has changed to ${proposal.status.replace(/_/g, ' ')}.`;
    if (proposal.status === 'PUBLISHED') {
      message = `Great news! Your proposal "${proposal.title}" has been approved and published for community support and public discussion.`;
    } else if (proposal.status === 'ACCEPTED_FOR_CONSIDERATION') {
      message = `Your proposal "${proposal.title}" has been officially accepted for municipal feasibility consideration.`;
    } else if (proposal.status === 'NEEDS_CLARIFICATION') {
      message = `A moderator has requested additional details for your proposal "${proposal.title}": ${proposal.publicExplanation || 'Please update your proposal.'}`;
    } else if (proposal.status === 'DECLINED') {
      message = `Your proposal "${proposal.title}" was declined. Reason: ${proposal.publicExplanation || 'Proposal does not meet moderation guidelines.'}`;
    }

    await this.sendNotification({
      userId: proposal.submitterId,
      type: NotificationType.PROPOSAL_STATUS_CHANGED,
      title: `Proposal Status Update: ${proposal.trackingId}`,
      message,
      entityType: 'PROPOSAL',
      entityId: proposal.id,
      actionUrl: `/engagement/proposals/${proposal.id}`,
    });
  }

  /**
   * Dispatches notifications when an official posts an authoritative response to a proposal
   */
  static async notifyProposalOfficialResponse(proposal: {
    id: string;
    trackingId: string;
    title: string;
    submitterId: string;
    officialResponse: string;
    responderName?: string;
  }) {
    const snippet = proposal.officialResponse.length > 100
      ? `${proposal.officialResponse.substring(0, 100)}...`
      : proposal.officialResponse;

    await this.sendNotification({
      userId: proposal.submitterId,
      type: NotificationType.PROPOSAL_RESPONSE,
      title: `Official Authority Response: ${proposal.trackingId}`,
      message: `An official response was posted on your proposal "${proposal.title}": "${snippet}"`,
      entityType: 'PROPOSAL',
      entityId: proposal.id,
      actionUrl: `/engagement/proposals/${proposal.id}`,
    });
  }

  /**
   * Dispatches notification to a citizen confirming their vote in a public poll
   */
  static async notifyVoteRecorded(poll: { id: string; title: string }, userId: string) {
    await this.sendNotification({
      userId,
      type: NotificationType.SYSTEM_ALERT,
      title: `Participation Recorded: ${poll.title}`,
      message: `Your response in the public civic poll "${poll.title}" has been securely recorded. Thank you for participating!`,
      entityType: 'POLL',
      entityId: poll.id,
      actionUrl: `/engagement/polls/${poll.id}`,
      deduplicateSeconds: 60,
    });
  }

  /**
   * Dispatches SLA warning notifications when a deadline is approaching
   */
  static async notifySlaWarning(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      assignedOfficialId?: string | null;
      assignedDepartmentId?: string | null;
    },
    hoursRemaining: number,
    deadlineType: 'RESPONSE' | 'RESOLUTION'
  ) {
    const recipients: string[] = [];
    if (complaint.assignedOfficialId) {
      recipients.push(complaint.assignedOfficialId);
    } else if (complaint.assignedDepartmentId) {
      const deptOfficials = await prisma.user.findMany({
        where: {
          departmentId: complaint.assignedDepartmentId,
          role: UserRole.GOVERNMENT_OFFICIAL,
        },
        select: { id: true },
        take: 5,
      });
      recipients.push(...deptOfficials.map((o) => o.id));
    }

    for (const userId of recipients) {
      await this.sendNotification({
        userId,
        type: NotificationType.SLA_WARNING,
        title: `SLA Warning: ${complaint.trackingId}`,
        message: `Complaint ${complaint.trackingId} is approaching its ${deadlineType.toLowerCase()} deadline with approximately ${hoursRemaining} hour(s) remaining. Please review progress.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/official/workspace`,
        deduplicateSeconds: 3600,
      });
    }
  }

  /**
   * Dispatches SLA breach notification when a deadline is missed
   */
  static async notifySlaBreach(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId?: string | null;
      assignedOfficialId?: string | null;
      assignedDepartmentId?: string | null;
    },
    breachType: 'RESPONSE' | 'RESOLUTION',
    hoursOverdue: number
  ) {
    // 1. Notify Official / Department Staff
    if (complaint.assignedOfficialId) {
      await this.sendNotification({
        userId: complaint.assignedOfficialId,
        type: NotificationType.SLA_BREACH,
        title: `SLA Deadline Missed: ${complaint.trackingId}`,
        message: `The ${breachType.toLowerCase()} deadline for ${complaint.trackingId} is overdue by ${hoursOverdue} hour(s). Immediate action or extension request is required.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/official/workspace`,
        deduplicateSeconds: 3600,
      });
    }

    // 2. Notify Citizen Transparently
    if (complaint.citizenId) {
      await this.sendNotification({
        userId: complaint.citizenId,
        type: NotificationType.SLA_BREACH,
        title: `Service Commitment Update: ${complaint.trackingId}`,
        message: `We note that the estimated ${breachType.toLowerCase()} target for your complaint "${complaint.title}" has passed. Our municipal team has been alerted to prioritize this case.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/track?id=${complaint.trackingId}`,
        deduplicateSeconds: 3600,
      });
    }
  }

  /**
   * Dispatches notification when a case escalates
   */
  static async notifyEscalationTriggered(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId?: string | null;
      assignedOfficialId?: string | null;
      assignedDepartmentId?: string | null;
    },
    escalation: {
      id: string;
      escalationLevel: string;
      triggerReason: string;
    }
  ) {
    // Notify assigned official
    if (complaint.assignedOfficialId) {
      await this.sendNotification({
        userId: complaint.assignedOfficialId,
        type: NotificationType.ESCALATION_TRIGGERED,
        title: `Case Escalated: ${complaint.trackingId}`,
        message: `Complaint ${complaint.trackingId} has been escalated to ${escalation.escalationLevel.replace(/_/g, ' ')}. Please review action requirements.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/official/workspace`,
        deduplicateSeconds: 1800,
      });
    }

    // Notify citizen that supervisory oversight has been triggered
    if (complaint.citizenId) {
      await this.sendNotification({
        userId: complaint.citizenId,
        type: NotificationType.ESCALATION_TRIGGERED,
        title: `Supervisory Escalation: ${complaint.trackingId}`,
        message: `Your complaint "${complaint.title}" has been escalated for supervisory oversight to expedite resolution.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/track?id=${complaint.trackingId}`,
        deduplicateSeconds: 1800,
      });
    }
  }

  /**
   * Dispatches notification when an extension is requested
   */
  static async notifySlaExtensionRequested(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      assignedDepartmentId?: string | null;
    },
    extensionRequest: {
      id: string;
      requestedResolutionDeadline: Date;
    }
  ) {
    // Notify department officials and administrators
    const adminUsers = await prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true },
      take: 5,
    });

    for (const admin of adminUsers) {
      await this.sendNotification({
        userId: admin.id,
        type: NotificationType.SLA_EXTENSION_REQUESTED,
        title: `SLA Extension Requested: ${complaint.trackingId}`,
        message: `An extension has been requested for complaint ${complaint.trackingId} to ${extensionRequest.requestedResolutionDeadline.toLocaleDateString()}. Review required.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/sla`,
        deduplicateSeconds: 600,
      });
    }
  }

  /**
   * Dispatches notification when an extension decision is rendered
   */
  static async notifySlaExtensionDecided(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId?: string | null;
      assignedOfficialId?: string | null;
    },
    status: 'APPROVED' | 'REJECTED',
    newDeadline?: Date
  ) {
    // Notify official
    if (complaint.assignedOfficialId) {
      await this.sendNotification({
        userId: complaint.assignedOfficialId,
        type: NotificationType.SLA_EXTENSION_DECIDED,
        title: `Extension Request ${status}: ${complaint.trackingId}`,
        message: `The extension request for complaint ${complaint.trackingId} was ${status.toLowerCase()}.${newDeadline ? ` New deadline: ${newDeadline.toLocaleDateString()}` : ''}`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/official/workspace`,
      });
    }

    // Notify citizen if approved
    if (complaint.citizenId && status === 'APPROVED' && newDeadline) {
      await this.sendNotification({
        userId: complaint.citizenId,
        type: NotificationType.SLA_EXTENSION_DECIDED,
        title: `Revised Target Date: ${complaint.trackingId}`,
        message: `A formal adjustment has been approved for complaint "${complaint.title}". Expected completion date is now ${newDeadline.toLocaleDateString()}.`,
        entityType: 'COMPLAINT',
        entityId: complaint.id,
        actionUrl: `/track?id=${complaint.trackingId}`,
      });
    }
  }

  /**
   * Dispatches notification when evidence is uploaded to a complaint
   */
  static async notifyEvidenceUploaded(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
      citizenId?: string | null;
      assignedOfficialId?: string | null;
    },
    document: {
      id: string;
      fileName: string;
      evidencePurpose: string;
    },
    uploaderRole: UserRole,
    uploaderName: string
  ) {
    if (uploaderRole === UserRole.CITIZEN) {
      // Citizen uploaded -> notify assigned official if assigned
      if (complaint.assignedOfficialId) {
        await this.sendNotification({
          userId: complaint.assignedOfficialId,
          type: NotificationType.EVIDENCE_UPLOADED,
          title: `Supporting Evidence Uploaded: ${complaint.trackingId}`,
          message: `${uploaderName} attached new evidence (${document.fileName}) for review on "${complaint.title}".`,
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          actionUrl: `/official/workspace`,
        });
      }
    } else {
      // Official uploaded progress or resolution evidence -> notify citizen
      if (complaint.citizenId) {
        const isResolution = document.evidencePurpose === 'RESOLUTION_PROOF';
        await this.sendNotification({
          userId: complaint.citizenId,
          type: isResolution
            ? NotificationType.RESOLUTION_PROOF_SUBMITTED
            : NotificationType.EVIDENCE_UPLOADED,
          title: isResolution
            ? `Resolution Proof Uploaded: ${complaint.trackingId}`
            : `Field Evidence Update: ${complaint.trackingId}`,
          message: `Official ${uploaderName} uploaded ${isResolution ? 'resolution proof' : 'field progress evidence'} (${document.fileName}) on your complaint.`,
          entityType: 'COMPLAINT',
          entityId: complaint.id,
          actionUrl: `/track?id=${complaint.trackingId}`,
        });
      }
    }
  }

  /**
   * Dispatches notification when evidence is reviewed (Approved, Rejected, or Resubmission Requested)
   */
  static async notifyEvidenceReviewed(
    complaint: {
      id: string;
      trackingId: string;
      title: string;
    },
    document: {
      id: string;
      fileName: string;
      uploaderId?: string | null;
    },
    decision: 'VERIFIED' | 'REJECTED' | 'RESUBMISSION_REQUESTED',
    reasonOrGuidance?: string | null
  ) {
    if (!document.uploaderId) return;

    let type: NotificationType = NotificationType.EVIDENCE_APPROVED;
    let title = `Evidence Verified: ${complaint.trackingId}`;
    let message = `Your evidence "${document.fileName}" for complaint ${complaint.trackingId} has been verified by the municipal reviewer.`;

    if (decision === 'REJECTED') {
      type = NotificationType.EVIDENCE_REJECTED;
      title = `Evidence Rejected: ${complaint.trackingId}`;
      message = `Your evidence "${document.fileName}" was rejected. Reason: ${reasonOrGuidance || 'Does not meet civic documentation guidelines'}.`;
    } else if (decision === 'RESUBMISSION_REQUESTED') {
      type = NotificationType.EVIDENCE_RESUBMISSION_REQUESTED;
      title = `Evidence Resubmission Requested: ${complaint.trackingId}`;
      message = `Additional or clearer evidence is requested for "${document.fileName}". Guidance: ${reasonOrGuidance || 'Please upload a clearer photograph'}.`;
    }

    await this.sendNotification({
      userId: document.uploaderId,
      type,
      title,
      message,
      entityType: 'COMPLAINT',
      entityId: complaint.id,
      actionUrl: `/track?id=${complaint.trackingId}`,
    });
  }
}

