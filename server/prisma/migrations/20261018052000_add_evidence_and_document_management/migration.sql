-- CreateEnum
CREATE TYPE "EvidencePurpose" AS ENUM ('CITIZEN_SUPPORTING', 'OFFICIAL_PROGRESS', 'RESOLUTION_PROOF', 'ADMINISTRATIVE_REVIEW');

-- CreateEnum
CREATE TYPE "EvidenceReviewStatus" AS ENUM ('PENDING_REVIEW', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'RESUBMISSION_REQUESTED', 'QUARANTINED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'EVIDENCE_UPLOADED';
ALTER TYPE "NotificationType" ADD VALUE 'EVIDENCE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'EVIDENCE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'EVIDENCE_RESUBMISSION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_PROOF_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_PROOF_VERIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'RESOLUTION_PROOF_REJECTED';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "evidencePurpose" "EvidencePurpose" NOT NULL DEFAULT 'CITIZEN_SUPPORTING';
ALTER TABLE "documents" ADD COLUMN "reviewStatus" "EvidenceReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW';
ALTER TABLE "documents" ADD COLUMN "sha256Checksum" VARCHAR(64);
ALTER TABLE "documents" ADD COLUMN "reviewedById" UUID;
ALTER TABLE "documents" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "reviewNotes" TEXT;
ALTER TABLE "documents" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "documents" ADD COLUMN "resubmissionGuidance" TEXT;
ALTER TABLE "documents" ADD COLUMN "replacedDocumentId" UUID;
ALTER TABLE "documents" ADD COLUMN "isQuarantined" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "quarantineReason" TEXT;

-- CreateTable
CREATE TABLE "evidence_review_logs" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "reviewerId" UUID,
    "fromStatus" "EvidenceReviewStatus",
    "toStatus" "EvidenceReviewStatus" NOT NULL,
    "decisionReason" TEXT,
    "guidance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_reviewStatus_idx" ON "documents"("reviewStatus");
CREATE INDEX "documents_evidencePurpose_idx" ON "documents"("evidencePurpose");
CREATE INDEX "documents_reviewedById_idx" ON "documents"("reviewedById");
CREATE INDEX "documents_isQuarantined_idx" ON "documents"("isQuarantined");

-- CreateIndex
CREATE INDEX "evidence_review_logs_documentId_idx" ON "evidence_review_logs"("documentId");
CREATE INDEX "evidence_review_logs_reviewerId_idx" ON "evidence_review_logs"("reviewerId");
CREATE INDEX "evidence_review_logs_createdAt_idx" ON "evidence_review_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_replacedDocumentId_fkey" FOREIGN KEY ("replacedDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_review_logs" ADD CONSTRAINT "evidence_review_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_review_logs" ADD CONSTRAINT "evidence_review_logs_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
