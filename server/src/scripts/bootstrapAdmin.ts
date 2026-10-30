/**
 * Civora Platform — Secure Administrator Provisioning Script
 * 
 * Usage:
 *   npx tsx src/scripts/bootstrapAdmin.ts --email admin@civora.local --password "SecureSecret123!" --name "Lead Administrator"
 * 
 * Or via environment variables:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@civora.local BOOTSTRAP_ADMIN_PASSWORD="SecureSecret123!" npx tsx src/scripts/bootstrapAdmin.ts
 */

import { prisma } from '../lib/prisma.js';
import { hashPassword } from '../lib/password.js';
import { UserRole, AccountStatus } from '@prisma/client';

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index !== -1 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return undefined;
}

async function bootstrapAdmin() {
  console.log('[Civora Admin Provisioning] Starting administrator bootstrap process...');

  const email = (
    getArg('--email') ||
    process.env.BOOTSTRAP_ADMIN_EMAIL ||
    ''
  ).trim().toLowerCase();

  const password = (
    getArg('--password') ||
    process.env.BOOTSTRAP_ADMIN_PASSWORD ||
    ''
  ).trim();

  const name = (
    getArg('--name') ||
    process.env.BOOTSTRAP_ADMIN_NAME ||
    'Platform Administrator'
  ).trim();

  const phone = (
    getArg('--phone') ||
    process.env.BOOTSTRAP_ADMIN_PHONE ||
    '+91 90000 00000'
  ).trim();

  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid administrator email address is required.');
    console.error('   Pass via --email <email> or BOOTSTRAP_ADMIN_EMAIL environment variable.');
    process.exit(1);
  }

  if (!password || password.length < 8) {
    console.error('❌ Error: A secure password with at least 8 characters is required.');
    console.error('   Pass via --password <password> or BOOTSTRAP_ADMIN_PASSWORD environment variable.');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  const passwordHash = await hashPassword(password);

  if (existingUser) {
    if (existingUser.role !== UserRole.ADMIN) {
      console.error(`❌ Error: An account with email '${email}' already exists with role '${existingUser.role}'.`);
      console.error('   Bootstrap script will not implicitly overwrite accounts of a different role.');
      process.exit(1);
    }

    // Safely update existing administrator credentials
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          phone,
          passwordHash,
          accountStatus: AccountStatus.ACTIVE,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: 'ADMIN_BOOTSTRAP_CREDENTIALS_ROTATED',
          entityType: 'USER',
          entityId: existingUser.id,
          actorId: existingUser.id,
          ipAddress: '127.0.0.1',
          userAgent: 'Civora-Bootstrap-CLI/1.0',
          details: {
            email,
            rotatedAt: new Date().toISOString(),
          },
        },
      });
    });

    console.log(`✅ Administrator account '${email}' credentials rotated successfully.`);
    return;
  }

  // Create new platform administrator
  const newAdmin = await prisma.$transaction(async (tx) => {
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
        ipAddress: '127.0.0.1',
        userAgent: 'Civora-Bootstrap-CLI/1.0',
        details: {
          email,
          provisionedAt: new Date().toISOString(),
        },
      },
    });

    return admin;
  });

  console.log(`✅ Administrator account provisioned successfully!`);
  console.log(`   Account ID: ${newAdmin.id}`);
  console.log(`   Email:      ${newAdmin.email}`);
  console.log(`   Name:       ${newAdmin.name}`);
  console.log(`   Role:       ${newAdmin.role}`);
  console.log(`   Status:     ${newAdmin.accountStatus}`);
}

bootstrapAdmin()
  .catch((err) => {
    console.error('❌ Bootstrap script encountered an unexpected error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
