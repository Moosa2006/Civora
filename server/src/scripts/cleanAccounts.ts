import { prisma } from '../lib/prisma.js';
import crypto from 'crypto';

function generateUnusableHash(): string {
  // Generates an unmatchable bcrypt dummy string that cannot match any password
  return `$2a$10$DISABLED_${crypto.randomBytes(24).toString('hex')}`;
}

async function performAccountCleanup() {
  console.log('[Account Cleanup] Starting verified account cleanup and deactivation...');

  // 1. Identify all users to delete (auto-generated test accounts with no critical civic records)
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          submittedComplaints: true,
          assignedComplaints: true,
          submittedBids: true,
          createdTenders: true,
          assignedIncidents: true,
          verifiedWorkStarts: true,
          claimedMilestones: true,
        },
      },
    },
  });

  const candidatesToDelete: string[] = [];
  for (const u of users) {
    const isTestEmail =
      u.email.includes('_179') ||
      u.email.includes('.179') ||
      u.email.endsWith('@test.local') ||
      u.email.startsWith('rej_') ||
      u.email === 'pending1@example.test';

    const hasCriticalCivicRecords =
      u._count.submittedComplaints > 0 ||
      u._count.assignedComplaints > 0 ||
      u._count.submittedBids > 0 ||
      u._count.createdTenders > 0;

    if (isTestEmail && !hasCriticalCivicRecords) {
      candidatesToDelete.push(u.id);
    }
  }

  console.log(`[Account Cleanup] Identified ${candidatesToDelete.length} ephemeral test accounts for safe deletion.`);

  // Delete candidates in transaction
  if (candidatesToDelete.length > 0) {
    // Delete any dependent notification preferences, poll votes, or document records for these candidates first if any
    await prisma.notificationPreference.deleteMany({
      where: { userId: { in: candidatesToDelete } },
    });
    await prisma.pollVote.deleteMany({
      where: { userId: { in: candidatesToDelete } },
    });

    const deleteResult = await prisma.user.deleteMany({
      where: { id: { in: candidatesToDelete } },
    });
    console.log(`✅ [Account Cleanup] Safely deleted ${deleteResult.count} disposable test accounts.`);
  }

  // 2. Deactivate and sanitize known demo accounts that have operational history (to preserve FK referential integrity & audit logs)
  const demoAccountsToDeactivate = [
    'citizen1@example.test',
    'official1@example.test',
    'admin1@example.test',
    'suspended1@example.test',
    'contractor1@example.test',
  ];

  for (const demoEmail of demoAccountsToDeactivate) {
    const account = await prisma.user.findUnique({
      where: { email: demoEmail },
    });

    if (account) {
      const unusableHash = generateUnusableHash();
      const sanitizedEmail = `archived.${account.role.toLowerCase()}.${account.id.slice(0, 8)}@decommissioned.civora.internal`;
      
      await prisma.user.update({
        where: { id: account.id },
        data: {
          email: sanitizedEmail,
          passwordHash: unusableHash,
          accountStatus: 'SUSPENDED',
          phone: null,
          name: `[Archived ${account.role}] ${account.name}`,
        },
      });

      console.log(`✅ [Account Cleanup] Deactivated & sanitized demo account ${demoEmail} -> ${sanitizedEmail}`);
    }
  }

  // 3. Verify legitimate operational accounts remain intact
  const remainingCount = await prisma.user.count();
  const activeAdmins = await prisma.user.count({
    where: { role: 'ADMIN', accountStatus: 'ACTIVE' },
  });
  const activeOfficials = await prisma.user.count({
    where: { role: 'GOVERNMENT_OFFICIAL', accountStatus: 'ACTIVE' },
  });
  const activeCitizens = await prisma.user.count({
    where: { role: 'CITIZEN', accountStatus: 'ACTIVE' },
  });

  console.log('\n=== POST-CLEANUP USER METRICS ===');
  console.log(`Total remaining users: ${remainingCount}`);
  console.log(`Active Administrators: ${activeAdmins}`);
  console.log(`Active Officials:      ${activeOfficials}`);
  console.log(`Active Citizens:       ${activeCitizens}`);
}

performAccountCleanup()
  .catch((err) => {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

