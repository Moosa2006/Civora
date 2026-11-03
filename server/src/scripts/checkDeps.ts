import { prisma } from '../lib/prisma.js';

async function checkAccountDependencies() {
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: {
          submittedComplaints: true,
          assignedComplaints: true,
          submittedBids: true,
          auditEvents: true,
          uploadedDocuments: true,
          sentComplaintMessages: true,
          submittedProposals: true,
          pollVotes: true,
          createdTenders: true,
          assignedIncidents: true,
          verifiedWorkStarts: true,
          claimedMilestones: true,
        },
      },
    },
  });

  const zeroDepUsers: string[] = [];
  const withDepUsers: any[] = [];

  for (const u of users) {
    const totalDeps = Object.values(u._count).reduce((a, b) => a + b, 0);
    if (totalDeps === 0) {
      zeroDepUsers.push(u.email);
    } else {
      withDepUsers.push({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.accountStatus,
        deps: u._count,
        totalDeps,
      });
    }
  }

  console.log(`Users with 0 dependencies: ${zeroDepUsers.length}`);
  console.log(`Users with >=1 dependencies: ${withDepUsers.length}`);
  console.log('\nUsers with dependencies:');
  console.log(JSON.stringify(withDepUsers, null, 2));
}

checkAccountDependencies()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

