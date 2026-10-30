import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { UserRole, AccountStatus, Prisma, ContractorStatus } from '@prisma/client';
import { hashPassword } from '../lib/password.js';
import { createOfficialSchema } from '../validation/auth.validation.js';


export async function getAdminUsers(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const qTerm = (req.query.q as string) || (req.query.search as string);
    const statusTerm = (req.query.accountStatus as string) || (req.query.status as string);
    const roleTerm = req.query.role as string;
    const departmentIdTerm = req.query.departmentId as string;

    const where: Prisma.UserWhereInput = {};

    if (typeof roleTerm === 'string' && roleTerm in UserRole) {
      where.role = roleTerm as UserRole;
    }

    if (typeof statusTerm === 'string' && statusTerm in AccountStatus) {
      where.accountStatus = statusTerm as AccountStatus;
    }

    if (typeof departmentIdTerm === 'string' && departmentIdTerm.trim().length > 0) {
      where.departmentId = departmentIdTerm.trim();
    }

    if (typeof qTerm === 'string' && qTerm.trim().length > 0) {
      const term = qTerm.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }


    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          accountStatus: true,
          departmentId: true,
          emailVerifiedAt: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        users: users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
          emailVerifiedAt: u.emailVerifiedAt?.toISOString() || null,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit) || 1,
          totalPages: Math.ceil(total / limit) || 1,
        },

      },
    });
  } catch (err: unknown) {
    console.error('[Admin Users List Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'USERS_FETCH_FAILED',
        message: 'Failed to retrieve platform user accounts.',
      },
    });
  }
}

export async function updateUserRole(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { role, departmentId } = req.body;

    if (!role || !(role in UserRole)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROLE',
          message: `Role must be one of: ${Object.values(UserRole).join(', ')}`,
        },
      });
    }

    // Safeguard 1: Cannot modify own role
    if (req.user?.id === id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_ROLE_MODIFICATION_PROHIBITED',
          message: 'Administrators cannot change their own platform role.',
        },
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user account was not found.',
        },
      });
    }

    // Safeguard 2: Cannot demote last active ADMIN
    if (targetUser.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
      const activeAdminCount = await prisma.user.count({
        where: { role: UserRole.ADMIN, accountStatus: AccountStatus.ACTIVE },
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LAST_ADMIN_PROTECTION',
            message: 'Operation rejected: Cannot remove or demote the last active platform administrator.',
          },
        });
      }
    }

    if (role === UserRole.GOVERNMENT_OFFICIAL && !departmentId && !targetUser.departmentId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DEPARTMENT_REQUIRED',
          message: 'A municipal department assignment is required for government official accounts.',
        },
      });
    }

    if (departmentId) {
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEPARTMENT',
            message: 'The specified municipal department was not found.',
          },
        });
      }
    }

    const previousRole = targetUser.role;



    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          role: role as UserRole,
          departmentId: departmentId !== undefined ? departmentId : targetUser.departmentId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accountStatus: true,
          departmentId: true,
        },
      });

      // Audit Event
      await tx.auditEvent.create({
        data: {
          action: 'USER_ROLE_CHANGED',
          entityType: 'USER',
          entityId: u.id,
          actorId: req.user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            targetUserId: u.id,
            targetEmail: u.email,
            previousRole,
            newRole: role,
          },
        },
      });

      return u;
    });

    return res.json({
      success: true,
      message: `User '${updated.name}' role updated from ${previousRole} to ${updated.role}.`,
      data: updated,
    });
  } catch (err: unknown) {
    console.error('[Admin Role Update Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'ROLE_UPDATE_FAILED',
        message: 'Failed to update user role.',
      },
    });
  }
}

export async function updateUserStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status, reason } = req.body;

    if (!status || !(status in AccountStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${Object.values(AccountStatus).join(', ')}`,
        },
      });
    }

    if (typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REASON_REQUIRED',
          message: 'A documented administrative reason of at least 5 characters is required.',
        },
      });
    }

    // Safeguard 1: Cannot suspend self
    if (req.user?.id === id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SELF_SUSPENSION_PROHIBITED',
          message: 'Administrators cannot alter their own account status.',
        },
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The target user account was not found.',
        },
      });
    }

    // Safeguard 2: Cannot suspend last active ADMIN
    if (targetUser.role === UserRole.ADMIN && status === AccountStatus.SUSPENDED) {
      const activeAdminCount = await prisma.user.count({
        where: { role: UserRole.ADMIN, accountStatus: AccountStatus.ACTIVE },
      });

      if (activeAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'LAST_ADMIN_PROTECTION',
            message: 'Operation rejected: Cannot suspend the last active platform administrator.',
          },
        });
      }
    }

    const previousStatus = targetUser.accountStatus;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          accountStatus: status as AccountStatus,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accountStatus: true,
        },
      });

      // Audit Event
      await tx.auditEvent.create({
        data: {
          action: 'USER_STATUS_CHANGED',
          entityType: 'USER',
          entityId: u.id,
          actorId: req.user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            targetUserId: u.id,
            targetEmail: u.email,
            previousStatus,
            newStatus: status,
            reason: reason.trim(),
          },
        },
      });

      return u;
    });

    return res.json({
      success: true,
      message: `User '${updated.name}' status updated to ${updated.accountStatus}.`,
      data: updated,
    });
  } catch (err: unknown) {
    console.error('[Admin User Status Update Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_UPDATE_FAILED',
        message: 'Failed to update user account status.',
      },
    });
  }
}

export async function createAdminOfficial(req: Request, res: Response) {
  try {
    const parseResult = createOfficialSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues?.[0];
      const message = issue ? issue.message : 'Validation failed.';
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message,
          details: parseResult.error.flatten().fieldErrors,
        },
      });
    }

    const { name, email, password, phone, departmentId } = parseResult.data;

    // Check if email already in use
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'An account with this email address already exists.',
        },
      });
    }

    // Check department existence
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DEPARTMENT',
          message: 'The selected municipal department does not exist.',
        },
      });
    }

    const passwordHash = await hashPassword(password);

    const newOfficial = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          passwordHash,
          role: UserRole.GOVERNMENT_OFFICIAL,
          accountStatus: AccountStatus.ACTIVE,
          departmentId,
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          accountStatus: true,
          departmentId: true,
          emailVerifiedAt: true,
          createdAt: true,
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'OFFICIAL_ACCOUNT_CREATED',
          entityType: 'USER',
          entityId: u.id,
          actorId: req.user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            officialId: u.id,
            officialEmail: u.email,
            officialName: u.name,
            departmentId,
            departmentCode: dept.code,
            departmentName: dept.name,
          },
        },
      });

      return u;
    });

    return res.status(201).json({
      success: true,
      message: `Government official account for '${newOfficial.name}' created successfully.`,
      data: newOfficial,
    });
  } catch (err: unknown) {
    console.error('[Create Admin Official Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'OFFICIAL_CREATION_FAILED',
        message: 'Failed to create government official account.',
      },
    });
  }
}

export async function getContractorApplications(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const { status, q } = req.query;

    const where: Prisma.ContractorWhereInput = {};

    if (status === 'PENDING') {
      where.isVerified = false;
    } else if (status === 'APPROVED') {
      where.isVerified = true;
      where.status = ContractorStatus.ACTIVE;
    } else if (status === 'REJECTED') {
      where.status = ContractorStatus.INACTIVE;
      where.isVerified = false;
    }

    if (typeof q === 'string' && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { registrationNumber: { contains: term, mode: 'insensitive' } },
        { contactPerson: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { panOrTaxId: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, contractors] = await Promise.all([
      prisma.contractor.count({ where }),
      prisma.contractor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          verifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              accountStatus: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        applications: contractors.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          verifiedAt: c.verifiedAt?.toISOString() || null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (err: unknown) {
    console.error('[Admin Contractor Applications Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACTOR_APPLICATIONS_FETCH_FAILED',
        message: 'Failed to retrieve contractor applications.',
      },
    });
  }
}

export async function approveContractorApplication(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { notes } = req.body;

    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: { users: true },
    });

    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTRACTOR_NOT_FOUND',
          message: 'The contractor organization was not found.',
        },
      });
    }

    if (contractor.isVerified && contractor.status === ContractorStatus.ACTIVE) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_APPROVED',
          message: 'This contractor application has already been verified and approved.',
        },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify and activate contractor
      const updatedContractor = await tx.contractor.update({
        where: { id },
        data: {
          isVerified: true,
          status: ContractorStatus.ACTIVE,
          verifiedAt: new Date(),
          verifiedById: req.user?.id,
        },
      });

      // 2. Activate all linked contractor user accounts
      await tx.user.updateMany({
        where: { contractorId: id },
        data: {
          accountStatus: AccountStatus.ACTIVE,
          role: UserRole.CONTRACTOR,
        },
      });

      // 3. Record Audit Event
      await tx.auditEvent.create({
        data: {
          action: 'CONTRACTOR_APPLICATION_APPROVED',
          entityType: 'CONTRACTOR',
          entityId: contractor.id,
          actorId: req.user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            contractorId: contractor.id,
            companyName: contractor.name,
            registrationNumber: contractor.registrationNumber,
            reviewerName: req.user?.name,
            notes: typeof notes === 'string' ? notes.trim() : 'Approved by administrator',
          },
        },
      });

      return updatedContractor;
    });

    return res.json({
      success: true,
      message: `Contractor '${result.name}' successfully approved. Organization and user accounts are now ACTIVE.`,
      data: result,
    });
  } catch (err: unknown) {
    console.error('[Approve Contractor Application Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACTOR_APPROVAL_FAILED',
        message: 'Failed to approve contractor application.',
      },
    });
  }
}

export async function rejectContractorApplication(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;

    if (typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REASON_REQUIRED',
          message: 'A documented rejection reason of at least 5 characters is required.',
        },
      });
    }

    const contractor = await prisma.contractor.findUnique({
      where: { id },
      include: { users: true },
    });

    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTRACTOR_NOT_FOUND',
          message: 'The contractor organization was not found.',
        },
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Mark contractor inactive
      const updatedContractor = await tx.contractor.update({
        where: { id },
        data: {
          isVerified: false,
          status: ContractorStatus.INACTIVE,
        },
      });

      // 2. Suspend linked user accounts
      await tx.user.updateMany({
        where: { contractorId: id },
        data: {
          accountStatus: AccountStatus.SUSPENDED,
        },
      });

      // 3. Record Audit Event
      await tx.auditEvent.create({
        data: {
          action: 'CONTRACTOR_APPLICATION_REJECTED',
          entityType: 'CONTRACTOR',
          entityId: contractor.id,
          actorId: req.user?.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            contractorId: contractor.id,
            companyName: contractor.name,
            registrationNumber: contractor.registrationNumber,
            reason: reason.trim(),
            reviewerName: req.user?.name,
          },
        },
      });

      return updatedContractor;
    });

    return res.json({
      success: true,
      message: `Contractor '${result.name}' application rejected. Reason documented in platform audit ledger.`,
      data: result,
    });
  } catch (err: unknown) {
    console.error('[Reject Contractor Application Error]:', err);
    return res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACTOR_REJECTION_FAILED',
        message: 'Failed to reject contractor application.',
      },
    });
  }
}

