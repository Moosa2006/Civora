import type { Request, Response, NextFunction } from 'express';
import { UserRole, AccountStatus, ContractorStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hashPassword, comparePassword } from '../lib/password.js';
import { signAuthToken } from '../lib/jwt.js';
import { registerSchema, loginSchema, registerContractorSchema } from '../validation/auth.validation.js';


const COOKIE_NAME = 'civora_auth_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS,
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
    const { email, registrationNumber } = req.query;

    if (!email && !registrationNumber) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'QUERY_REQUIRED',
          message: 'Please provide either an applicant email address or company registration number.',
        },
      });
    }

    let contractor = null;

    if (registrationNumber && typeof registrationNumber === 'string') {
      contractor = await prisma.contractor.findUnique({
        where: { registrationNumber: registrationNumber.trim().toUpperCase() },
        include: {
          users: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              accountStatus: true,
            },
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
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  accountStatus: true,
                },
              },
            },
          },
        },
      });
      contractor = user?.contractor || null;
    }

    if (!contractor) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'APPLICATION_NOT_FOUND',
          message: 'No contractor application matching the provided details was found.',
        },
      });
    }

    // Determine status: APPROVED, REJECTED, or UNDER_REVIEW
    let status = 'UNDER_REVIEW';
    if (contractor.isVerified && contractor.status === ContractorStatus.ACTIVE) {
      status = 'APPROVED';
    } else if (contractor.status === ContractorStatus.BLACKLISTED || contractor.users.some((u) => u.accountStatus === AccountStatus.SUSPENDED)) {
      status = 'REJECTED';
    }

    // Fetch latest review audit event if exists
    const reviewEvent = await prisma.auditEvent.findFirst({
      where: {
        entityType: 'CONTRACTOR',
        entityId: contractor.id,
        action: { in: ['CONTRACTOR_APPLICATION_APPROVED', 'CONTRACTOR_APPLICATION_REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        createdAt: true,
        details: true,
      },
    });

    const details = reviewEvent?.details as Record<string, unknown> | null;

    return res.status(200).json({
      success: true,
      data: {
        companyName: contractor.name,
        registrationNumber: contractor.registrationNumber,
        contactPerson: contractor.contactPerson,
        email: contractor.email,
        licenseClass: contractor.licenseClass,
        workCategories: contractor.workCategories,
        operatingRegion: contractor.operatingRegion,
        status,
        isVerified: contractor.isVerified,
        submittedAt: contractor.createdAt.toISOString(),
        verifiedAt: contractor.verifiedAt ? contractor.verifiedAt.toISOString() : null,
        reviewNotes: (typeof details?.reason === 'string' ? details.reason : null),
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
      console.warn(`[Civora Auth ${req.correlationId || 'N/A'}]: Login request validation failed:`, parseResult.error.flatten().fieldErrors);
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
      console.warn(`[Civora Auth ${req.correlationId || 'N/A'}]: Login failed — no user record found for email "${email}".`);
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
      console.warn(`[Civora Auth ${req.correlationId || 'N/A'}]: Login failed — password verification failed for user "${user.id}" (${email}).`);
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

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      accountStatus: user.accountStatus,
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
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
