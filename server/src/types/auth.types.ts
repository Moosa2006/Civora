import type { UserRole, AccountStatus } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  departmentId: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  department?: {
    id: string;
    code: string;
    name: string;
  } | null;
  contractorId?: string | null;
  contractor?: {
    id: string;
    name: string;
    registrationNumber: string | null;
    status: string;
    isVerified: boolean;
    licenseClass: string | null;
    workCategories: string[];
  } | null;
}

// Extend Express Request interface globally
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}
