-- AlterEnum NotificationType additions
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MODERATION_WARNING';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CONTENT_MODERATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ACCOUNT_RESTRICTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RESTRICTION_LIFTED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'APPEAL_DECISION';

-- CreateEnum AbuseReportReason
DO $$ BEGIN
  CREATE TYPE "AbuseReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'PERSONAL_DATA_EXPOSURE', 'IMPERSONATION', 'MALICIOUS_OR_SUSPICIOUS', 'MISINFORMATION', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum AbuseReportStatus
DO $$ BEGIN
  CREATE TYPE "AbuseReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED_ACTION_TAKEN', 'RESOLVED_NO_VIOLATION', 'DISMISSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum ReportTargetType
DO $$ BEGIN
  CREATE TYPE "ReportTargetType" AS ENUM ('COMPLAINT', 'COMPLAINT_MESSAGE', 'PROPOSAL', 'PROPOSAL_COMMENT', 'POLL', 'DOCUMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum ModerationCaseStatus
DO $$ BEGIN
  CREATE TYPE "ModerationCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTION_TAKEN', 'RESOLVED_NO_VIOLATION', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum ModerationPriority
DO $$ BEGIN
  CREATE TYPE "ModerationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum ModerationActionType
DO $$ BEGIN
  CREATE TYPE "ModerationActionType" AS ENUM ('NO_ACTION', 'WARNING_ISSUED', 'CONTENT_HIDDEN', 'CONTENT_REMOVED', 'CONTENT_RESTORED', 'ACCOUNT_RESTRICTED', 'DUPLICATE_LINKED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum AppealStatus
DO $$ BEGIN
  CREATE TYPE "AppealStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'UPHELD', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum UserRestrictionType
DO $$ BEGIN
  CREATE TYPE "UserRestrictionType" AS ENUM ('SUBMISSION_RESTRICTED', 'COMMENTING_RESTRICTED', 'UPLOAD_RESTRICTED', 'ACCOUNT_SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable complaints
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "isModerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "moderationReason" TEXT;

-- AlterTable complaint_messages
ALTER TABLE "complaint_messages" ADD COLUMN IF NOT EXISTS "isModerated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "complaint_messages" ADD COLUMN IF NOT EXISTS "moderationReason" VARCHAR(255);

-- AlterTable community_proposals
ALTER TABLE "community_proposals" ADD COLUMN IF NOT EXISTS "isModerated" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable abuse_reports
CREATE TABLE IF NOT EXISTS "abuse_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trackingId" VARCHAR(32) NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reporterId" UUID,
    "reason" "AbuseReportReason" NOT NULL,
    "explanation" TEXT,
    "status" "AbuseReportStatus" NOT NULL DEFAULT 'PENDING',
    "caseId" UUID,
    "ipAddress" VARCHAR(45),
    "assignedModeratorId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abuse_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable moderation_cases
CREATE TABLE IF NOT EXISTS "moderation_cases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caseNumber" VARCHAR(32) NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "targetOwnerId" UUID,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ModerationPriority" NOT NULL DEFAULT 'MEDIUM',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskFactors" JSONB,
    "assignedModeratorId" UUID,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable moderation_actions
CREATE TABLE IF NOT EXISTS "moderation_actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL,
    "moderatorId" UUID,
    "actionType" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "internalNotes" TEXT,
    "targetSnapshot" JSONB,
    "isAutomated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable moderation_appeals
CREATE TABLE IF NOT EXISTS "moderation_appeals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caseId" UUID NOT NULL,
    "appellantId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" UUID,
    "decisionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "moderation_appeals_pkey" PRIMARY KEY ("id")
);

-- CreateTable user_restrictions
CREATE TABLE IF NOT EXISTS "user_restrictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "restrictionType" "UserRestrictionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "liftedAt" TIMESTAMP(3),
    "liftedById" UUID,
    "liftReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable complaint_duplicate_links
CREATE TABLE IF NOT EXISTS "complaint_duplicate_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "primaryComplaintId" UUID NOT NULL,
    "duplicateComplaintId" UUID NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "reason" TEXT,
    "linkedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_duplicate_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "abuse_reports_trackingId_key" ON "abuse_reports"("trackingId");
CREATE INDEX IF NOT EXISTS "abuse_reports_targetType_targetId_idx" ON "abuse_reports"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "abuse_reports_status_idx" ON "abuse_reports"("status");
CREATE INDEX IF NOT EXISTS "abuse_reports_reporterId_idx" ON "abuse_reports"("reporterId");
CREATE INDEX IF NOT EXISTS "abuse_reports_caseId_idx" ON "abuse_reports"("caseId");
CREATE INDEX IF NOT EXISTS "abuse_reports_assignedModeratorId_idx" ON "abuse_reports"("assignedModeratorId");
CREATE INDEX IF NOT EXISTS "abuse_reports_createdAt_idx" ON "abuse_reports"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "moderation_cases_caseNumber_key" ON "moderation_cases"("caseNumber");
CREATE INDEX IF NOT EXISTS "moderation_cases_targetType_targetId_idx" ON "moderation_cases"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "moderation_cases_status_idx" ON "moderation_cases"("status");
CREATE INDEX IF NOT EXISTS "moderation_cases_priority_idx" ON "moderation_cases"("priority");
CREATE INDEX IF NOT EXISTS "moderation_cases_assignedModeratorId_idx" ON "moderation_cases"("assignedModeratorId");
CREATE INDEX IF NOT EXISTS "moderation_cases_targetOwnerId_idx" ON "moderation_cases"("targetOwnerId");
CREATE INDEX IF NOT EXISTS "moderation_cases_createdAt_idx" ON "moderation_cases"("createdAt");

CREATE INDEX IF NOT EXISTS "moderation_actions_caseId_idx" ON "moderation_actions"("caseId");
CREATE INDEX IF NOT EXISTS "moderation_actions_moderatorId_idx" ON "moderation_actions"("moderatorId");
CREATE INDEX IF NOT EXISTS "moderation_actions_actionType_idx" ON "moderation_actions"("actionType");
CREATE INDEX IF NOT EXISTS "moderation_actions_createdAt_idx" ON "moderation_actions"("createdAt");

CREATE INDEX IF NOT EXISTS "moderation_appeals_caseId_idx" ON "moderation_appeals"("caseId");
CREATE INDEX IF NOT EXISTS "moderation_appeals_appellantId_idx" ON "moderation_appeals"("appellantId");
CREATE INDEX IF NOT EXISTS "moderation_appeals_status_idx" ON "moderation_appeals"("status");
CREATE INDEX IF NOT EXISTS "moderation_appeals_createdAt_idx" ON "moderation_appeals"("createdAt");

CREATE INDEX IF NOT EXISTS "user_restrictions_userId_isActive_idx" ON "user_restrictions"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "user_restrictions_restrictionType_idx" ON "user_restrictions"("restrictionType");
CREATE INDEX IF NOT EXISTS "user_restrictions_expiresAt_idx" ON "user_restrictions"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "complaint_duplicate_links_primaryComplaintId_duplicateComplaintId_key" ON "complaint_duplicate_links"("primaryComplaintId", "duplicateComplaintId");
CREATE INDEX IF NOT EXISTS "complaint_duplicate_links_primaryComplaintId_idx" ON "complaint_duplicate_links"("primaryComplaintId");
CREATE INDEX IF NOT EXISTS "complaint_duplicate_links_duplicateComplaintId_idx" ON "complaint_duplicate_links"("duplicateComplaintId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "moderation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "abuse_reports" ADD CONSTRAINT "abuse_reports_assignedModeratorId_fkey" FOREIGN KEY ("assignedModeratorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_targetOwnerId_fkey" FOREIGN KEY ("targetOwnerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_cases" ADD CONSTRAINT "moderation_cases_assignedModeratorId_fkey" FOREIGN KEY ("assignedModeratorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "moderation_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_appellantId_fkey" FOREIGN KEY ("appellantId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_liftedById_fkey" FOREIGN KEY ("liftedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "complaint_duplicate_links" ADD CONSTRAINT "complaint_duplicate_links_primaryComplaintId_fkey" FOREIGN KEY ("primaryComplaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "complaint_duplicate_links" ADD CONSTRAINT "complaint_duplicate_links_duplicateComplaintId_fkey" FOREIGN KEY ("duplicateComplaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "complaint_duplicate_links" ADD CONSTRAINT "complaint_duplicate_links_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
