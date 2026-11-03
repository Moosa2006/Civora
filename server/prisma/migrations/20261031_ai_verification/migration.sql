-- CIVORA PRODUCTION ADDITIVE MIGRATION: AI Verification, Fraud Detection & Evidence Tracking
-- Safe for Supabase PostgreSQL (Idempotent: uses IF NOT EXISTS)

-- 1. Extend complaints table
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiAnalysisStatus" VARCHAR(32) DEFAULT 'PENDING';
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiRiskLevel" VARCHAR(32);
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiRiskScore" INTEGER DEFAULT 0;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiFindings" JSONB;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3);
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "duplicateConfidence" DOUBLE PRECISION;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "primaryComplaintId" UUID;

-- 2. Create indexes on complaints
CREATE INDEX IF NOT EXISTS "complaints_aiAnalysisStatus_idx" ON "complaints"("aiAnalysisStatus");
CREATE INDEX IF NOT EXISTS "complaints_aiRiskLevel_idx" ON "complaints"("aiRiskLevel");
CREATE INDEX IF NOT EXISTS "complaints_isDuplicate_idx" ON "complaints"("isDuplicate");
CREATE INDEX IF NOT EXISTS "complaints_primaryComplaintId_idx" ON "complaints"("primaryComplaintId");

-- 3. Self-referential foreign key for duplicate hierarchy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'complaints_primaryComplaintId_fkey'
  ) THEN
    ALTER TABLE "complaints" ADD CONSTRAINT "complaints_primaryComplaintId_fkey"
      FOREIGN KEY ("primaryComplaintId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Extend documents table for evidence capture metadata & perceptual hashing
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "perceptualHash" VARCHAR(64);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureLatitude" DECIMAL(10,7);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureLongitude" DECIMAL(10,7);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "captureAccuracy" DOUBLE PRECISION;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "isGpsVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "browserCaptureTimestamp" TIMESTAMP(3);

-- 5. Create indexes on documents
CREATE INDEX IF NOT EXISTS "documents_sha256Checksum_idx" ON "documents"("sha256Checksum");
CREATE INDEX IF NOT EXISTS "documents_perceptualHash_idx" ON "documents"("perceptualHash");

