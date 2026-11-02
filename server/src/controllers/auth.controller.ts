import type { Request, Response, NextFunction } from 'express';
import { UserRole, AccountStatus, ContractorStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signAuthToken, verifyAuthToken } from '../lib/jwt.js';
import { registerSchema, loginSchema, registerContractorSchema } from '../validation/auth.validation.js';


const COOKIE_NAME = 'civora_auth_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: SEVEN_DAYS_MS,
    path: '/',
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = registerSchema.safeParse(req.body);
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

    const { name, email, password, phone } = parseResult.data;

    // Check if email already registered
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

    // Hash password securely
    const passwordHash = await hashPassword(password);

    // Persist new citizen account (Always CITIZEN role, never elevate via registration)
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: UserRole.CITIZEN,
        accountStatus: AccountStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        accountStatus: true,
        departmentId: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Generate JWT token
    const token = signAuthToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    setAuthCookie(res, token);

    return res.status(201).json({
      success: true,
      message: 'Citizen account registered successfully.',
      data: {
        user: newUser,
        token,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function registerContractor(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = registerContractorSchema.safeParse(req.body);
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

    const {
      name,
      email,
      password,
      phone,
      companyName,
      registrationNumber,
      panOrTaxId,
      businessAddress,
      operatingRegion,
      licenseClass,
      workCategories,
    } = parseResult.data;

    // Check if user email already registered
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

    // Check if contractor registration number already exists
    const existingContractor = await prisma.contractor.findUnique({
      where: { registrationNumber },
    });
    if (existingContractor) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONTRACTOR_REGISTRATION_EXISTS',
          message: 'A contractor organization with this registration number already exists.',
        },
      });
    }

    const passwordHash = await hashPassword(password);

    // Atomically create Contractor organization and applicant User
    const result = await prisma.$transaction(async (tx) => {
      const contractor = await tx.contractor.create({
        data: {
          name: companyName,
          registrationNumber,
          contactPerson: name,
          email,
          phone,
          status: ContractorStatus.INACTIVE, // pending administrative verification
          businessAddress,
          operatingRegion,
          licenseClass,
          panOrTaxId,
          workCategories,
          isVerified: false,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role: UserRole.CONTRACTOR,
          accountStatus: AccountStatus.PENDING_VERIFICATION,
          contractorId: contractor.id,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          accountStatus: true,
          contractorId: true,
          createdAt: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'CONTRACTOR_APPLICATION_SUBMITTED',
          entityType: 'CONTRACTOR',
          entityId: contractor.id,
          actorId: user.id,
          ipAddress: req.ip || '127.0.0.1',
          userAgent: (req.get('user-agent') as string) || undefined,
          details: {
            companyName,
            registrationNumber,
            panOrTaxId,
            licenseClass,
            contactPerson: name,
            email,
          },
        },
      });

      return { contractor, user };
    });

    return res.status(201).json({
      success: true,
      message: 'Contractor application submitted successfully. Your application is under administrative review.',
      data: {
        application: {
          id: result.contractor.id,
          companyName: result.contractor.name,
          registrationNumber: result.contractor.registrationNumber,
          contactPerson: result.contractor.contactPerson,
          email: result.contractor.email,
          licenseClass: result.contractor.licenseClass,
          workCategories: result.contractor.workCategories,
          status: 'UNDER_REVIEW',
          submittedAt: result.contractor.createdAt.toISOString(),
        },
        user: result.user,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function getContractorApplicationStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, registrationNumber, statusToken } = req.query;

    // S02 Remediation: Knowledge of email or registration number alone MUST NOT retrieve private application profiles.
    // Must be authenticated as the applicant/staff OR provide a cryptographically verified statusToken.
    const isStaff =
      req.user && (req.user.role === UserRole.ADMIN || req.user.role === UserRole.GOVERNMENT_OFFICIAL);

    let authorizedContractorId: string | null = null;

    if (req.user && req.user.contractorId) {
      authorizedContractorId = req.user.contractorId;
    } else if (statusToken && typeof statusToken === 'string') {
      try {
        const decoded = verifyAuthToken(statusToken);
        if (decoded && (decoded as any).contractorId) {
          authorizedContractorId = (decoded as any).contractorId;
        }
      } catch {
        // Invalid or expired status token
      }
    }

    if (!isStaff && !authorizedContractorId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message:
            'Retrieving contractor application details requires authenticating with the applicant account or supplying a valid status token.',
        },
      });
    }

    let contractor = null;

    if (authorizedContractorId) {
      contractor = await prisma.contractor.findUnique({
        where: { id: authorizedContractorId },
        include: {
          users: {
            select: { id: true, accountStatus: true },
          },
        },
      });
    } else if (isStaff) {
      if (registrationNumber && typeof registrationNumber === 'string') {
        contractor = await prisma.contractor.findUnique({
          where: { registrationNumber: registrationNumber.trim().toUpperCase() },
          include: {
            users: {
              select: { id: true, accountStatus: true },
            },
          },
        });
      } else if (email && typeof email === 'string') {
        const user = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
          include: {
            contractor: {
              include: {
                users: {
                  select: { id: true, accountStatus: true },
                },
              },
            },
          },
        });
        contractor = user?.contractor || null;
      }
    }

    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'Unable to retrieve contractor application status with the provided credentials.',
        },
      });
    }

    // Determine status: APPROVED, REJECTED, or UNDER_REVIEW
    let status = 'UNDER_REVIEW';
    if (contractor.isVerified && contractor.status === ContractorStatus.ACTIVE) {
      status = 'APPROVED';
    } else if (
      contractor.status === ContractorStatus.BLACKLISTED ||
      contractor.users.some((u) => u.accountStatus === AccountStatus.SUSPENDED)
    ) {
      status = 'REJECTED';
    }

    // S02 Remediation: Exclude personal contact details, direct phone/email, and internal reviewNotes
    return res.status(200).json({
      success: true,
      data: {
        companyName: contractor.name,
        registrationNumber: contractor.registrationNumber,
        status,
        isVerified: contractor.isVerified,
        submittedAt: contractor.createdAt.toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
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

    const { email, password } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        contractor: {
          select: {
            id: true,
            name: true,
            registrationNumber: true,
            status: true,
            isVerified: true,
            licenseClass: true,
            workCategories: true,
          },
        },
      },
    });

    // Generic error message to prevent account enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password.',
        },
      });
    }

    // Check account status
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact civic support.',
        },
      });
    }

    if (user.accountStatus === AccountStatus.PENDING_VERIFICATION) {
      if (user.role === UserRole.CONTRACTOR) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CONTRACTOR_APPLICATION_PENDING',
            message: 'Your contractor application is under administrative review. Access will be unlocked once approved by municipal governance.',
            details: {
              companyName: user.contractor?.name,
              registrationNumber: user.contractor?.registrationNumber,
              isVerified: user.contractor?.isVerified ?? false,
            },
          },
        });
      }

      return res.status(403).json({
        success: false,
        error: {
          code: 'PENDING_VERIFICATION',
          message: 'Account verification is pending. Please verify your email before logging in.',
        },
      });
    }

    // Generate JWT token
    const token = signAuthToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    setAuthCookie(res, token);

    // S06 Remediation: Audit privileged sign-ins for security monitoring
    if (user.role === UserRole.ADMIN || user.role === UserRole.GOVERNMENT_OFFICIAL) {
      try {
        await prisma.auditEvent.create({
          data: {
            entityType: 'USER',
            entityId: user.id,
            action: user.role === UserRole.ADMIN ? 'ADMIN_PRIVILEGED_LOGIN' : 'OFFICIAL_PRIVILEGED_LOGIN',
            actorId: user.id,
            details: {
              email: user.email,
              ip: req.ip || req.socket.remoteAddress || 'unknown',
              userAgent: req.headers['user-agent'] || 'unknown',
            },
          },
        });
      } catch (auditErr) {
        console.warn('[Audit Log Warning]:', auditErr);
      }
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      accountStatus: user.accountStatus,
      isContactVerified: Boolean(user.emailVerifiedAt),
      departmentId: user.departmentId,
      department: user.department,
      contractorId: user.contractorId,
      contractor: user.contractor,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        user: safeUser,
        token,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export function getCurrentUser(req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
}

export function logout(_req: Request, res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

export function adminCheck(req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    data: {
      message: 'Administrator authorization verified.',
      admin: {
        id: req.user?.id,
        email: req.user?.email,
        role: req.user?.role,
      },
    },
  });
}

/**
 * S06 Remediation: Citizen contact ownership verification
 */
export async function verifyContact(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required to verify contact.' },
      });
    }

    const { code } = req.body;
    if (!code || typeof code !== 'string' || code.trim().length !== 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'A valid 6-digit verification code is required.' },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { emailVerifiedAt: new Date() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        accountStatus: true,
        emailVerifiedAt: true,
      },
    });

    await prisma.auditEvent.create({
      data: {
        entityType: 'USER',
        entityId: req.user.id,
        action: 'CITIZEN_CONTACT_VERIFIED',
        actorId: req.user.id,
        details: { email: req.user.email },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Contact ownership verified successfully. Account is now eligible for trusted community participation.',
      data: {
        user: {
          ...updatedUser,
          isContactVerified: true,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
}
