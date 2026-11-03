import { prisma } from '../lib/prisma.js';
import { ensureBaselineMetadata } from '../lib/metadataBootstrap.js';

async function main() {
  console.log('----------------------------------------------------');
  console.log('Civora — Production Metadata Bootstrap');
  console.log('Ensuring municipal departments and complaint categories...');
  console.log('----------------------------------------------------');

  try {
    const result = await ensureBaselineMetadata();
    console.log(`[Success] Baseline metadata check complete.`);
    console.log(`  - Departments: ${result.departments}`);
    console.log(`  - Categories:  ${result.categories}`);
    console.log(`  - Seeded fresh: ${result.seeded}`);

    // Verify retrieval
    const categories = await prisma.complaintCategory.findMany({
      where: { isActive: true },
      include: { department: true },
    });

    console.log('\nActive Categories in Database:');
    categories.forEach((cat) => {
      console.log(`  • [${cat.code}] ${cat.name} (${cat.department.name})`);
    });
  } catch (err) {
    console.error('[Error] Metadata bootstrap failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

