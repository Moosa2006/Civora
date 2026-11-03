import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { isMaintenanceModeActive } from '../lib/configService.js';
import { UserRole, AccountStatus, ComplaintStatus } from '@prisma/client';

export async function getAdminDashboardOverview(_req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const [
      // 1. User metrics (grouped by role)
      userRoleGroups,
      suspendedUsers,

      // 2. Complaint metrics (grouped by status)
      complaintStatusGroups,

      // 3. SLA & Escalations
      activeEscalations,
      overdueComplaintsCount,

      // 4. Moderation
      openModerationCases,
      pendingAbuseReports,
      pendingAppeals,

      // 5. Engagement
      totalProposals,
      openPolls,

      // 6. Notifications
      totalNotifications,
      unreadNotifications,

      // 7. Operational Incidents
      openIncidents,
      criticalIncidents,

      // 8. Recent Audit Events
      recentAuditEvents,

      // 9. Recent Incidents
      recentIncidents,

      // 10. Maintenance Mode
      maintenanceMode,
    ] = await Promise.all([
      // Users by role
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
      prisma.user.count({ where: { accountStatus: AccountStatus.SUSPENDED } }),

      // Complaints by status
      prisma.complaint.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // SLA
      prisma.complaintEscalation.count({
        where: { status: { in: ['ACTIVE', 'ACKNOWLEDGED', 'ACTION_PLANNED'] } },
      }),
      prisma.complaintSla.count({
        where: {
          OR: [
            { isResolutionOverdue: true },
            { isResponseOverdue: true },
            { slaStatus: { in: ['RESPONSE_OVERDUE', 'RESOLUTION_OVERDUE', 'BREACHED'] } },
          ],
        },
      }),

      // Moderation
      prisma.moderationCase.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
      prisma.abuseReport.count({
        where: { status: 'PENDING' },
      }),
      prisma.moderationAppeal.count({
        where: { status: 'PENDING' },
      }),

      // Engagement
      prisma.communityProposal.count({
        where: { status: { in: ['PUBLISHED', 'ACCEPTED_FOR_CONSIDERATION'] } },
      }),
      prisma.publicPoll.count({
        where: { status: 'OPEN' },
      }),

      // Notifications
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),

      // Incidents
      prisma.operationalIncident.count({
        where: { status: { in: ['OPEN', 'INVESTIGATING', 'MONITORING'] } },
      }),
      prisma.operationalIncident.count({
        where: {
          status: { in: ['OPEN', 'INVESTIGATING'] },
          severity: { in: ['CRITICAL', 'HIGH'] },
        },
      }),

      // Recent 10 Audit Events
      prisma.auditEvent.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),

      // Recent 5 Incidents
      prisma.operationalIncident.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          incidentNumber: true,
          title: true,
          severity: true,
          status: true,
          createdAt: true,
        },
      }),

      // Maintenance
      isMaintenanceModeActive(),
    ]);

    // Map user counts
    let totalUsers = 0;
    const userRoleCounts: Record<string, number> = {};
    for (const g of userRoleGroups) {
      userRoleCounts[g.role] = g._count.id;
      totalUsers += g._count.id;
    }

    // Map complaint counts
    let totalComplaints = 0;
    const complaintStatusCounts: Record<string, number> = {};
    for (const g of complaintStatusGroups) {
      complaintStatusCounts[g.status] = g._count.id;
      totalComplaints += g._count.id;
    }

    const submitted = complaintStatusCounts[ComplaintStatus.SUBMITTED] || 0;
    const underReview = complaintStatusCounts[ComplaintStatus.UNDER_REVIEW] || 0;
    const assigned = complaintStatusCounts[ComplaintStatus.ASSIGNED] || 0;
    const inProgress = complaintStatusCounts[ComplaintStatus.IN_PROGRESS] || 0;
    const resolved = complaintStatusCounts[ComplaintStatus.RESOLVED] || 0;
    const verified = complaintStatusCounts[ComplaintStatus.VERIFIED] || 0;
    const reopened = complaintStatusCounts[ComplaintStatus.REOPENED] || 0;
    const rejected = complaintStatusCounts[ComplaintStatus.REJECTED] || 0;
    const closed = complaintStatusCounts[ComplaintStatus.CLOSED] || 0;

    const latencyMs = Date.now() - startTime;

    return res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        queryLatencyMs: latencyMs,
        maintenanceMode,
        // Metrics object matching frontend DashboardOverviewData schema
        metrics: {
          totalUsers,
          activeUsers: Math.max(0, totalUsers - suspendedUsers),
          usersByRole: {
            CITIZEN: userRoleCounts[UserRole.CITIZEN] || 0,
            OFFICIAL: userRoleCounts[UserRole.GOVERNMENT_OFFICIAL] || 0,
            ADMIN: userRoleCounts[UserRole.ADMIN] || 0,
            CONTRACTOR: userRoleCounts[UserRole.CONTRACTOR] || 0,
          },
          totalComplaints,
          complaintsAwaitingAction: submitted + underReview,
          complaintsInProgress: assigned + inProgress,
          complaintsResolved: resolved + verified + closed,
          complaintsRejected: rejected,
          complaintsOverdue: overdueComplaintsCount,
          openIncidents,
          recentAuditActionsCount: recentAuditEvents.length,
        },
        users: {
          total: totalUsers,
          citizens: userRoleCounts[UserRole.CITIZEN] || 0,
          officials: userRoleCounts[UserRole.GOVERNMENT_OFFICIAL] || 0,
          admins: userRoleCounts[UserRole.ADMIN] || 0,
          active: Math.max(0, totalUsers - suspendedUsers),
          suspended: suspendedUsers,
        },
        complaints: {
          total: totalComplaints,
          submitted,
          underReview,
          assigned,
          inProgress,
          resolved,
          verified,
          reopened,
          rejected,
          closed,
          awaitingAction: submitted + underReview,
          activeBacklog: assigned + inProgress,
          overdue: overdueComplaintsCount,
        },
        sla: {
          activeEscalations,
          overdueBreaches: overdueComplaintsCount,
        },
        moderation: {
          openCases: openModerationCases,
          pendingAbuseReports,
          pendingAppeals,
        },
        engagement: {
          publishedProposals: totalProposals,
          activePolls: openPolls,
        },
        notifications: {
          totalDispatched: totalNotifications,
          unread: unreadNotifications,
        },
        incidents: {
          openCount: openIncidents,
          criticalCount: criticalIncidents,
        },
        recentAuditEvents: recentAuditEvents.map((evt) => ({
          id: evt.id,
          action: evt.action,
          entityType: evt.entityType,
          entityId: evt.entityId,
          createdAt: evt.createdAt.toISOString(),
          ipAddress: evt.ipAddress,
          actor: evt.actor
            ? {
                id: evt.actor.id,
                name: evt.actor.name,
                email: evt.actor.email,
                role: evt.actor.role,
              }
            : null,
          details: evt.details,
        })),
        recentIncidents: recentIncidents.map((inc) => ({
          id: inc.id,
          incidentNumber: inc.incidentNumber,
          title: inc.title,
          severity: inc.severity,
          status: inc.status,
          createdAt: inc.createdAt.toISOString(),
        })),
      },
    });
  } catch (err: unknown) {
    console.error('[Admin Dashboard Overview Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_FETCH_FAILED',
        message: 'Failed to retrieve administrative overview metrics.',
      },
    });
  }
}
