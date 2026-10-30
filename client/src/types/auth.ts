export type UserRole = 'CITIZEN' | 'GOVERNMENT_OFFICIAL' | 'ADMIN' | 'CONTRACTOR';
export type AccountStatus = 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  departmentId?: string | null;
  department?: {
    id: string;
    code: string;
    name: string;
  } | null;
  contractorId?: string | null;
  contractor?: {
    id: string;
    name: string;
    registrationNumber?: string | null;
    status: string;
    isVerified: boolean;
    licenseClass?: string | null;
    workCategories: string[];
  } | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
