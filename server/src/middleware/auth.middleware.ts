import type { Request, Response, NextFunction } from 'express';
import { UserRole, AccountStatus } from '@prisma/client';
import { verifyAuthToken } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  let token: string | undefined;

  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies.civora_auth_token) {
    token = req.cookies.civora_auth_token;
  }

  // 2. Fall back to Authorization: Bearer <token>
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please log in.',
      },
    });
  }

  const payload = verifyAuthToken(token);
  if (!payload || !payload.userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Session expired or invalid. Please log in again.',
      },
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        contractorId: true,
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

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'The account associated with this session no longer exists.',
        },
      });
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_SUSPENDED',
          message: 'Your account has been suspended. Please contact civic support.',
        },
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      });
    }

    return next();
  };
}

export async function optionalAuthenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  let token: string | undefined;

  if (req.cookies && req.cookies.civora_auth_token) {
    token = req.cookies.civora_auth_token;
  }

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return next();
  }

  try {
    const payload = verifyAuthToken(token);
    if (payload && payload.userId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
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
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          contractorId: true,
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

      if (user && user.accountStatus !== AccountStatus.SUSPENDED) {
        req.user = user;
      }
    }
  } catch {
    // Silently continue for optional authentication
  }

  return next();
}

