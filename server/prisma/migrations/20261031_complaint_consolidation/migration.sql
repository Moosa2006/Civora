-- Additive migration for Intelligent Complaint Consolidation & Master Issue Management

ALTER TABLE "complaints" 
ADD COLUMN IF NOT EXISTS "isMaster" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "affectedReportCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "distinctReporterCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "consolidationReason" TEXT,
ADD COLUMN IF NOT EXISTS "consolidatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "priorityEscalatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "priorityEscalationReason" TEXT;

CREATE INDEX IF NOT EXISTS "complaints_isMaster_idx" ON "complaints"("isMaster");
CREATE INDEX IF NOT EXISTS "complaints_affectedReportCount_idx" ON "complaints"("affectedReportCount");

UPDATE "complaints"
SET "isMaster" = false
WHERE "primaryComplaintId" IS NOT NULL AND "isMaster" = true;

