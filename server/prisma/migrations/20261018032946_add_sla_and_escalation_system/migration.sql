-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'APPROACHING_DEADLINE', 'RESPONSE_OVERDUE', 'RESOLUTION_OVERDUE', 'BREACHED', 'RESOLVED_ON_TIME', 'RESOLVED_LATE', 'NO_SLA');

-- CreateEnum
CREATE TYPE "EscalationLevel" AS ENUM ('LEVEL_1_OFFICIAL', 'LEVEL_2_SUPERVISOR', 'LEVEL_3_HEAD_ADMIN');

-- CreateEnum
CREATE TYPE "EscalationStatus" AS ENUM ('ACTIVE', 'ACKNOWLEDGED', 'ACTION_PLANNED', 'RESOLVED', 'DE_ESCALATED');

-- CreateEnum
CREATE TYPE "EscalationTrigger" AS ENUM ('RESPONSE_DEADLINE_MISSED', 'RESOLUTION_DEADLINE_MISSED', 'OVERDUE_GRACE_EXCEEDED', 'MANUAL_SUPERVISOR_ESCALATION', 'REPEATED_BREACH');

-- CreateEnum
CREATE TYPE "ExtensionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SLA_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_BREACH';
ALTER TYPE "NotificationType" ADD VALUE 'ESCALATION_TRIGGERED';
ALTER TYPE "NotificationType" ADD VALUE 'ESCALATION_ACKNOWLEDGED';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_EXTENSION_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'SLA_EXTENSION_DECIDED';

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "priority" "ComplaintPriority",
    "responseTargetHours" INTEGER NOT NULL DEFAULT 24,
    "resolutionTargetHours" INTEGER NOT NULL DEFAULT 72,
    "warningThresholdHours" INTEGER NOT NULL DEFAULT 12,
    "escalationThresholdHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveStartDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveEndDate" TIMESTAMP(3),
    "createdById" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_slas" (
    "id" UUID NOT NULL,
    "complaintId" UUID NOT NULL,
    "policyId" UUID,
    "policyName" VARCHAR(255) NOT NULL,
    "responseTargetHours" INTEGER NOT NULL,
    "resolutionTargetHours" INTEGER NOT NULL,
    "clockStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "originalResponseDeadline" TIMESTAMP(3) NOT NULL,
    "originalResolutionDeadline" TIMESTAMP(3) NOT NULL,
    "currentResponseDeadline" TIMESTAMP(3) NOT NULL,
    "currentResolutionDeadline" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "isResponseOverdue" BOOLEAN NOT NULL DEFAULT false,
    "isResolutionOverdue" BOOLEAN NOT NULL DEFAULT false,
    "slaStatus" "SlaStatus" NOT NULL DEFAULT 'ON_TRACK',
    "estimatedCompletionDate" TIMESTAMP(3),
    "estimatedCompletionNotes" TEXT,
    "warningSentAt" TIMESTAMP(3),
    "breachNotificationSentAt" TIMESTAMP(3),
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaint_slas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_escalations" (
    "id" UUID NOT NULL,
    "complaintId" UUID NOT NULL,
    "escalationLevel" "EscalationLevel" NOT NULL DEFAULT 'LEVEL_1_OFFICIAL',
    "triggerReason" "EscalationTrigger" NOT NULL,
    "notes" TEXT NOT NULL,
    "status" "EscalationStatus" NOT NULL DEFAULT 'ACTIVE',
    "escalatedToDepartmentId" UUID,
    "escalatedToOfficialId" UUID,
    "escalatedById" UUID,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT true,
    "acknowledgedById" UUID,
    "acknowledgedAt" TIMESTAMP(3),
    "actionPlan" TEXT,
    "actionPlanRecordedAt" TIMESTAMP(3),
    "actionPlanRecordedById" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaint_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_action_logs" (
    "id" UUID NOT NULL,
    "escalationId" UUID NOT NULL,
    "actorId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "escalation_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_extension_requests" (
    "id" UUID NOT NULL,
    "complaintId" UUID NOT NULL,
    "complaintSlaId" UUID NOT NULL,
    "requestedByOfficialId" UUID NOT NULL,
    "previousResolutionDeadline" TIMESTAMP(3) NOT NULL,
    "requestedResolutionDeadline" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ExtensionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionById" UUID,
    "decisionNotes" TEXT,
    "decisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_extension_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sla_policies_categoryId_idx" ON "sla_policies"("categoryId");

-- CreateIndex
CREATE INDEX "sla_policies_priority_idx" ON "sla_policies"("priority");

-- CreateIndex
CREATE INDEX "sla_policies_isActive_idx" ON "sla_policies"("isActive");

-- CreateIndex
CREATE INDEX "sla_policies_isDefault_idx" ON "sla_policies"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_slas_complaintId_key" ON "complaint_slas"("complaintId");

-- CreateIndex
CREATE INDEX "complaint_slas_slaStatus_idx" ON "complaint_slas"("slaStatus");

-- CreateIndex
CREATE INDEX "complaint_slas_currentResolutionDeadline_idx" ON "complaint_slas"("currentResolutionDeadline");

-- CreateIndex
CREATE INDEX "complaint_slas_currentResponseDeadline_idx" ON "complaint_slas"("currentResponseDeadline");

-- CreateIndex
CREATE INDEX "complaint_slas_isResolutionOverdue_idx" ON "complaint_slas"("isResolutionOverdue");

-- CreateIndex
CREATE INDEX "complaint_escalations_complaintId_idx" ON "complaint_escalations"("complaintId");

-- CreateIndex
CREATE INDEX "complaint_escalations_status_idx" ON "complaint_escalations"("status");

-- CreateIndex
CREATE INDEX "complaint_escalations_escalationLevel_idx" ON "complaint_escalations"("escalationLevel");

-- CreateIndex
CREATE INDEX "complaint_escalations_escalatedToDepartmentId_idx" ON "complaint_escalations"("escalatedToDepartmentId");

-- CreateIndex
CREATE INDEX "complaint_escalations_escalatedToOfficialId_idx" ON "complaint_escalations"("escalatedToOfficialId");

-- CreateIndex
CREATE INDEX "escalation_action_logs_escalationId_idx" ON "escalation_action_logs"("escalationId");

-- CreateIndex
CREATE INDEX "escalation_action_logs_createdAt_idx" ON "escalation_action_logs"("createdAt");

-- CreateIndex
CREATE INDEX "sla_extension_requests_complaintId_idx" ON "sla_extension_requests"("complaintId");

-- CreateIndex
CREATE INDEX "sla_extension_requests_status_idx" ON "sla_extension_requests"("status");

-- CreateIndex
CREATE INDEX "sla_extension_requests_requestedByOfficialId_idx" ON "sla_extension_requests"("requestedByOfficialId");

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "complaint_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_slas" ADD CONSTRAINT "complaint_slas_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_slas" ADD CONSTRAINT "complaint_slas_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "sla_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_escalations" ADD CONSTRAINT "complaint_escalations_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_escalations" ADD CONSTRAINT "complaint_escalations_escalatedToDepartmentId_fkey" FOREIGN KEY ("escalatedToDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_escalations" ADD CONSTRAINT "complaint_escalations_escalatedToOfficialId_fkey" FOREIGN KEY ("escalatedToOfficialId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_escalations" ADD CONSTRAINT "complaint_escalations_escalatedById_fkey" FOREIGN KEY ("escalatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_escalations" ADD CONSTRAINT "complaint_escalations_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_escalations" ADD CONSTRAINT "complaint_escalations_actionPlanRecordedById_fkey" FOREIGN KEY ("actionPlanRecordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_escalations" ADD CONSTRAINT "complaint_escalations_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_action_logs" ADD CONSTRAINT "escalation_action_logs_escalationId_fkey" FOREIGN KEY ("escalationId") REFERENCES "complaint_escalations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_action_logs" ADD CONSTRAINT "escalation_action_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_extension_requests" ADD CONSTRAINT "sla_extension_requests_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_extension_requests" ADD CONSTRAINT "sla_extension_requests_complaintSlaId_fkey" FOREIGN KEY ("complaintSlaId") REFERENCES "complaint_slas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_extension_requests" ADD CONSTRAINT "sla_extension_requests_requestedByOfficialId_fkey" FOREIGN KEY ("requestedByOfficialId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_extension_requests" ADD CONSTRAINT "sla_extension_requests_decisionById_fkey" FOREIGN KEY ("decisionById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
