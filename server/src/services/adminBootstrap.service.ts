import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { UserRole, AccountStatus } from '@prisma/client';

export interface SafeAdminRecord {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: Date;
}

export interface ProvisionAdminInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
}

let isBootstrapping = false;

/**
 * Checks whether an administrator account already exists in the database.
 */
export async function checkAdminExists(): Promise<boolean> {
  const adminCount = await prisma.user.count({
    where: { role: UserRole.ADMIN },
  });
  return adminCount > 0;
}

/**
 * Checks whether the administrator bootstrap endpoint is configured with a valid secret.
 * Requires ADMIN_SETUP_SECRET to be non-empty and at least 32 characters in length.
 */
export function isBootstrapConfigured(): boolean {
  const secret = process.env.ADMIN_SETUP_SECRET;
  return typeof secret === 'string' && secret.trim().length >= 32;
}

/**
 * Validates the provided setup secret using a constant-time comparison to prevent timing attacks.
 */
export function verifySetupSecret(candidateSecret?: string): boolean {
  const configuredSecret = process.env.ADMIN_SETUP_SECRET;
  if (!configuredSecret || configuredSecret.trim().length < 32 || !candidateSecret) {
    return false;
  }

  const configuredBuffer = Buffer.from(configuredSecret.trim(), 'utf8');
  const candidateBuffer = Buffer.from(candidateSecret.trim(), 'utf8');

  // Both buffers must be non-empty and of identical length for timingSafeEqual
  if (configuredBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(configuredBuffer, candidateBuffer);
}

/**
 * Atomically provisions the first platform administrator account.
 * Enforces strict single-administrator constraint, password hashing, and audit logging.
 */
export async function provisionInitialAdmin(
  input: ProvisionAdminInput
): Promise<{ success: boolean; user: SafeAdminRecord }> {
  if (isBootstrapping) {
    throw new Error('BOOTSTRAP_IN_PROGRESS');
  }

  isBootstrapping = true;

  try {
    const existingAdminCount = await prisma.user.count({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdminCount > 0) {
      throw new Error('ADMIN_ALREADY_EXISTS');
    }

    const email = input.email.trim().toLowerCase();
    const existingUserWithEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUserWithEmail) {
      throw new Error('EMAIL_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);
    const name = input.name?.trim() || 'Platform Administrator';
    const phone = input.phone?.trim() || null;

    const newAdmin = await prisma.$transaction(async (tx) => {
      // Re-verify inside transaction to prevent race conditions
      const doubleCheckAdmin = await tx.user.count({
        where: { role: UserRole.ADMIN },
      });

      if (doubleCheckAdmin > 0) {
        throw new Error('ADMIN_ALREADY_EXISTS');
      }

      const admin = await tx.user.create({
        data: {
          name,
          email,
          phone,
          passwordHash,
          role: UserRole.ADMIN,
          accountStatus: AccountStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          accountStatus: true,
          createdAt: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'ADMIN_BOOTSTRAP_PROVISIONED',
          entityType: 'USER',
          entityId: admin.id,
          actorId: admin.id,
          ipAddress: input.ipAddress || '127.0.0.1',
          userAgent: input.userAgent || 'Civora-Bootstrap-Service/1.0',
          details: {
            email: admin.email,
            provisionedAt: new Date().toISOString(),
            channel: 'PRODUCTION_ONE_TIME_API',
          },
        },
      });

      return admin;
    });

    console.log(`[Civora Admin Bootstrap] Initial platform administrator account provisioned: ${newAdmin.email}`);

    return {
      success: true,
      user: newAdmin,
    };
  } finally {
    isBootstrapping = false;
  }
}

