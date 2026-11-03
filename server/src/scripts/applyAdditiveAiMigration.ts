import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyAdditiveMigration() {
  console.log('[Civora Additive Migration] Applying additive AI verification columns to Supabase PostgreSQL...');

  const migrationFilePath = path.join(__dirname, '../../prisma/migrations/20261031_ai_verification/migration.sql');
  const sqlContent = fs.readFileSync(migrationFilePath, 'utf-8');

  // Statements to run
  const statements = [
    // Complaints additive columns
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiAnalysisStatus" VARCHAR(32) DEFAULT 'PENDING';`,
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiRiskLevel" VARCHAR(32);`,
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiRiskScore" INTEGER DEFAULT 0;`,
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiFindings" JSONB;`,
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3);`,
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "duplicateConfidence" DOUBLE PRECISION;`,
    `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "primaryComplaintId" UUID;`,

    // Complaints indexes
    `CREATE INDEX IF NOT EXISTS "complaints_aiAnalysisStatus_idx" ON "complaints"("aiAnalysisStatus");`,
    `CREATE INDEX IF NOT EXISTS "complaints_aiRiskLevel_idx" ON "complaints"("aiRiskLevel");`,
    `CREATE INDEX IF NOT EXISTS "complaints_isDuplicate_idx" ON "complaints"("isDuplicate");`,
    `CREATE INDEX IF NOT EXISTS "complaints_primaryComplaintId_idx" ON "complaints"("primaryComplaintId");`,

    // Documents additive columns
    `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "perceptualHash" VARCHAR(64);`,
    `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3);`,
    `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureLatitude" DECIMAL(10,7);`,
    `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureLongitude" DECIMAL(10,7);`,
    `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureAccuracy" DOUBLE PRECISION;`,
    `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "isGpsVerified" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "browserCaptureTimestamp" TIMESTAMP(3);`,

    // Documents indexes
    `CREATE INDEX IF NOT EXISTS "documents_sha256Checksum_idx" ON "documents"("sha256Checksum");`,
    `CREATE INDEX IF NOT EXISTS "documents_perceptualHash_idx" ON "documents"("perceptualHash");`,
  ];

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  ✓ Executed: ${stmt.slice(0, 60)}...`);
    } catch (err: any) {
      console.warn(`  ⚠ Statement warning: ${err?.message || err}`);
    }
  }

  // Self-referential constraint
  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'complaints_primaryComplaintId_fkey'
        ) THEN
          ALTER TABLE "complaints" ADD CONSTRAINT "complaints_primaryComplaintId_fkey"
            FOREIGN KEY ("primaryComplaintId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$;
    `);
    console.log('  ✓ Executed: self-referential foreign key constraint');
  } catch (err: any) {
    console.warn(`  ⚠ Constraint warning: ${err?.message || err}`);
  }

  console.log('[Civora Additive Migration] Successfully completed!');
  await prisma.$disconnect();
}

applyAdditiveMigration().catch((err) => {
  console.error('[Civora Additive Migration] Failed:', err);
  process.exit(1);
});

