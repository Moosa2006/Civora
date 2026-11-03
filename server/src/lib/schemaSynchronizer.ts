import { prisma } from './prisma.js';

export interface SchemaSyncResult {
  synced: boolean;
  statementsExecuted: number;
  warnings: string[];
  durationMs: number;
}

let inFlightSync: Promise<SchemaSyncResult> | null = null;

/**
 * All additive DDL statements required across Civora production lifecycle.
 * Idempotent: safe to run repeatedly on any PostgreSQL database without data loss.
 */
const SCHEMA_SYNC_STATEMENTS: { desc: string; sql: string }[] = [
  // 1. Enum value additions (wrapped in exception blocks for older pg versions)
  {
    desc: 'Enum: UserRole CONTRACTOR',
    sql: `DO $$ BEGIN ALTER TYPE "UserRole" ADD VALUE 'CONTRACTOR'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    desc: 'Enum: DocumentCategory TENDER_DOCUMENT',
    sql: `DO $$ BEGIN ALTER TYPE "DocumentCategory" ADD VALUE 'TENDER_DOCUMENT'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    desc: 'Enum: DocumentCategory BID_PROPOSAL',
    sql: `DO $$ BEGIN ALTER TYPE "DocumentCategory" ADD VALUE 'BID_PROPOSAL'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    desc: 'Enum: NotificationType TENDER_PUBLISHED',
    sql: `DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'TENDER_PUBLISHED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    desc: 'Enum: NotificationType BID_SUBMITTED',
    sql: `DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'BID_SUBMITTED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },
  {
    desc: 'Enum: NotificationType CONTRACT_AWARDED',
    sql: `DO $$ BEGIN ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_AWARDED'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
  },

  // 2. Users table extensions
  {
    desc: 'Users: contractorId column',
    sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "contractorId" UUID;`,
  },

  // 3. Contractors table extensions
  {
    desc: 'Contractors: businessAddress column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "businessAddress" TEXT;`,
  },
  {
    desc: 'Contractors: isVerified column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;`,
  },
  {
    desc: 'Contractors: licenseClass column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "licenseClass" VARCHAR(50) DEFAULT 'CLASS_B';`,
  },
  {
    desc: 'Contractors: operatingRegion column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "operatingRegion" VARCHAR(255);`,
  },
  {
    desc: 'Contractors: panOrTaxId column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "panOrTaxId" VARCHAR(50);`,
  },
  {
    desc: 'Contractors: verifiedAt column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);`,
  },
  {
    desc: 'Contractors: verifiedById column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "verifiedById" UUID;`,
  },
  {
    desc: 'Contractors: workCategories column',
    sql: `ALTER TABLE "contractors" ADD COLUMN IF NOT EXISTS "workCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];`,
  },

  // 4. Complaints table extensions (Geospatial, Moderation, AI verification, Consolidation)
  {
    desc: 'Complaints: locationSource column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "locationSource" VARCHAR(50);`,
  },
  {
    desc: 'Complaints: locationAccuracy column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "locationAccuracy" DOUBLE PRECISION;`,
  },
  {
    desc: 'Complaints: isLocationPublic column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isLocationPublic" BOOLEAN NOT NULL DEFAULT true;`,
  },
  {
    desc: 'Complaints: isModerated column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isModerated" BOOLEAN NOT NULL DEFAULT false;`,
  },
  {
    desc: 'Complaints: moderationReason column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "moderationReason" TEXT;`,
  },
  {
    desc: 'Complaints: aiAnalysisStatus column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiAnalysisStatus" VARCHAR(32) DEFAULT 'PENDING';`,
  },
  {
    desc: 'Complaints: aiRiskLevel column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiRiskLevel" VARCHAR(32);`,
  },
  {
    desc: 'Complaints: aiRiskScore column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiRiskScore" INTEGER DEFAULT 0;`,
  },
  {
    desc: 'Complaints: aiFindings column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiFindings" JSONB;`,
  },
  {
    desc: 'Complaints: aiAnalyzedAt column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3);`,
  },
  {
    desc: 'Complaints: isDuplicate column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT false;`,
  },
  {
    desc: 'Complaints: duplicateConfidence column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "duplicateConfidence" DOUBLE PRECISION;`,
  },
  {
    desc: 'Complaints: primaryComplaintId column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "primaryComplaintId" UUID;`,
  },
  {
    desc: 'Complaints: isMaster column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isMaster" BOOLEAN NOT NULL DEFAULT true;`,
  },
  {
    desc: 'Complaints: affectedReportCount column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "affectedReportCount" INTEGER NOT NULL DEFAULT 1;`,
  },
  {
    desc: 'Complaints: distinctReporterCount column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "distinctReporterCount" INTEGER NOT NULL DEFAULT 1;`,
  },
  {
    desc: 'Complaints: consolidationReason column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "consolidationReason" TEXT;`,
  },
  {
    desc: 'Complaints: consolidatedAt column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "consolidatedAt" TIMESTAMP(3);`,
  },
  {
    desc: 'Complaints: priorityEscalatedAt column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "priorityEscalatedAt" TIMESTAMP(3);`,
  },
  {
    desc: 'Complaints: priorityEscalationReason column',
    sql: `ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "priorityEscalationReason" TEXT;`,
  },

  // 5. Documents table extensions (Evidence verification, Perceptual hashing, Geolocation capture)
  {
    desc: 'Documents: perceptualHash column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "perceptualHash" VARCHAR(64);`,
  },
  {
    desc: 'Documents: capturedAt column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3);`,
  },
  {
    desc: 'Documents: captureLatitude column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureLatitude" DECIMAL(10,7);`,
  },
  {
    desc: 'Documents: captureLongitude column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureLongitude" DECIMAL(10,7);`,
  },
  {
    desc: 'Documents: captureAccuracy column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureAccuracy" DOUBLE PRECISION;`,
  },
  {
    desc: 'Documents: isGpsVerified column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "isGpsVerified" BOOLEAN NOT NULL DEFAULT false;`,
  },
  {
    desc: 'Documents: browserCaptureTimestamp column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "browserCaptureTimestamp" TIMESTAMP(3);`,
  },
  {
    desc: 'Documents: defectRequestId column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "defectRequestId" UUID;`,
  },
  {
    desc: 'Documents: milestoneId column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "milestoneId" UUID;`,
  },
  {
    desc: 'Documents: tenderBidId column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tenderBidId" UUID;`,
  },
  {
    desc: 'Documents: tenderId column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tenderId" UUID;`,
  },
  {
    desc: 'Documents: workStartId column',
    sql: `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "workStartId" UUID;`,
  },

  // 6. Duplicate Complaints Table
  {
    desc: 'Table: complaint_duplicate_links',
    sql: `CREATE TABLE IF NOT EXISTS "complaint_duplicate_links" (
      "id" UUID NOT NULL DEFAULT gen_random_uuid(),
      "primaryComplaintId" UUID NOT NULL,
      "duplicateComplaintId" UUID NOT NULL,
      "confidenceScore" DOUBLE PRECISION NOT NULL,
      "similarityMetrics" JSONB,
      "linkedByUserId" UUID,
      "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "complaint_duplicate_links_pkey" PRIMARY KEY ("id")
    );`,
  },

  // 7. Foreign key constraints
  {
    desc: 'Constraint: complaints self-referential primaryComplaintId foreign key',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_primaryComplaintId_fkey') THEN
        ALTER TABLE "complaints" ADD CONSTRAINT "complaints_primaryComplaintId_fkey"
          FOREIGN KEY ("primaryComplaintId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;`,
  },
  {
    desc: 'Constraint: users contractorId foreign key',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_contractorId_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_contractorId_fkey"
          FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;`,
  },
  {
    desc: 'Constraint: complaint_duplicate_links primary foreign key',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaint_duplicate_links_primaryComplaintId_fkey') THEN
        ALTER TABLE "complaint_duplicate_links" ADD CONSTRAINT "complaint_duplicate_links_primaryComplaintId_fkey"
          FOREIGN KEY ("primaryComplaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,
  },
  {
    desc: 'Constraint: complaint_duplicate_links duplicate foreign key',
    sql: `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaint_duplicate_links_duplicateComplaintId_fkey') THEN
        ALTER TABLE "complaint_duplicate_links" ADD CONSTRAINT "complaint_duplicate_links_duplicateComplaintId_fkey"
          FOREIGN KEY ("duplicateComplaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;`,
  },

  // 8. Performance Indexes
  {
    desc: 'Index: complaints aiAnalysisStatus',
    sql: `CREATE INDEX IF NOT EXISTS "complaints_aiAnalysisStatus_idx" ON "complaints"("aiAnalysisStatus");`,
  },
  {
    desc: 'Index: complaints aiRiskLevel',
    sql: `CREATE INDEX IF NOT EXISTS "complaints_aiRiskLevel_idx" ON "complaints"("aiRiskLevel");`,
  },
  {
    desc: 'Index: complaints isDuplicate',
    sql: `CREATE INDEX IF NOT EXISTS "complaints_isDuplicate_idx" ON "complaints"("isDuplicate");`,
  },
  {
    desc: 'Index: complaints primaryComplaintId',
    sql: `CREATE INDEX IF NOT EXISTS "complaints_primaryComplaintId_idx" ON "complaints"("primaryComplaintId");`,
  },
  {
    desc: 'Index: complaints isMaster',
    sql: `CREATE INDEX IF NOT EXISTS "complaints_isMaster_idx" ON "complaints"("isMaster");`,
  },
  {
    desc: 'Index: complaints affectedReportCount',
    sql: `CREATE INDEX IF NOT EXISTS "complaints_affectedReportCount_idx" ON "complaints"("affectedReportCount");`,
  },
  {
    desc: 'Index: documents sha256Checksum',
    sql: `CREATE INDEX IF NOT EXISTS "documents_sha256Checksum_idx" ON "documents"("sha256Checksum");`,
  },
  {
    desc: 'Index: documents perceptualHash',
    sql: `CREATE INDEX IF NOT EXISTS "documents_perceptualHash_idx" ON "documents"("perceptualHash");`,
  },
  {
    desc: 'Index: complaint_duplicate_links primaryComplaintId',
    sql: `CREATE INDEX IF NOT EXISTS "complaint_duplicate_links_primaryComplaintId_idx" ON "complaint_duplicate_links"("primaryComplaintId");`,
  },
  {
    desc: 'Index: complaint_duplicate_links duplicateComplaintId',
    sql: `CREATE INDEX IF NOT EXISTS "complaint_duplicate_links_duplicateComplaintId_idx" ON "complaint_duplicate_links"("duplicateComplaintId");`,
  },
  {
    desc: 'Unique Index: complaint_duplicate_links primary duplicate pair',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "complaint_duplicate_links_primary_duplicate_unique" ON "complaint_duplicate_links"("primaryComplaintId", "duplicateComplaintId");`,
  },
];

/**
 * Execute all additive database synchronization statements.
 * Safe for Supabase PgBouncer pooler connection strings.
 */
async function runSchemaSync(): Promise<SchemaSyncResult> {
  const startTime = Date.now();
  let executedCount = 0;
  const warnings: string[] = [];

  console.log('[Civora Schema Synchronizer] Verifying and applying additive database schema...');

  for (const item of SCHEMA_SYNC_STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(item.sql);
      executedCount++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Suppress benign warnings (e.g., column already exists, already in enum)
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.includes('NOTICE')
      ) {
        executedCount++;
      } else {
        warnings.push(`${item.desc}: ${msg}`);
        console.warn(`[Civora Schema Synchronizer Warning] ${item.desc}:`, msg);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[Civora Schema Synchronizer] Database schema synchronization complete in ${durationMs}ms (${executedCount}/${SCHEMA_SYNC_STATEMENTS.length} statements verified).`
  );

  return {
    synced: warnings.length === 0,
    statementsExecuted: executedCount,
    warnings,
    durationMs,
  };
}

/**
 * Guarantees schema synchronization with concurrency de-duplication.
 */
export async function ensureDatabaseSchema(): Promise<SchemaSyncResult> {
  if (inFlightSync) {
    return inFlightSync;
  }

  inFlightSync = runSchemaSync().finally(() => {
    inFlightSync = null;
  });

  return inFlightSync;
}

