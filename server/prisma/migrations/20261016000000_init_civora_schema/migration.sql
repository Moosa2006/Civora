-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CITIZEN', 'GOVERNMENT_OFFICIAL', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'PENDING_VERIFICATION', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ComplaintPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'REOPENED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CivicWorkStatus" AS ENUM ('PROPOSED', 'SANCTIONED', 'TENDERING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionOutcome" AS ENUM ('SATISFACTORY', 'NEEDS_REPAIR', 'WORK_REQUIRED', 'RESOLVED_ON_SITE', 'INVALID_COMPLAINT');

-- CreateEnum
CREATE TYPE "FeasibilityAssessment" AS ENUM ('FEASIBLE', 'CONDITIONALLY_FEASIBLE', 'NOT_FEASIBLE', 'REQUIRES_FURTHER_STUDY');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVISED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('TECHNICAL_SANCTION', 'ADMINISTRATIVE_APPROVAL', 'FINANCIAL_SANCTION', 'WORK_ORDER_APPROVAL');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MODIFICATIONS_REQUESTED');

-- CreateEnum
CREATE TYPE "ContractorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('AWARDED', 'COMMENCED', 'IN_PROGRESS', 'SUBSTANTIALLY_COMPLETED', 'COMPLETED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "FinancialRecordType" AS ENUM ('BUDGET_ALLOCATION', 'CONTRACTOR_PAYMENT', 'EXPENSE_REIMBURSEMENT', 'RETENTION_HOLD', 'PENALTY_DEDUCTION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PLANNED', 'PROCESSING', 'PAID', 'HELD', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentCategory" AS ENUM ('COMPLAINT_EVIDENCE', 'INSPECTION_PHOTO', 'ASSESSMENT_REPORT', 'DPR_DOCUMENT', 'APPROVAL_LETTER', 'WORK_ORDER_COPY', 'PROGRESS_PHOTO', 'INVOICE_RECEIPT', 'COMPLETION_CERTIFICATE');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PUBLIC', 'INTERNAL_OFFICIAL', 'RESTRICTED_ADMIN');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "departmentId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaint_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CITIZEN',
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "departmentId" UUID,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaints" (
    "id" UUID NOT NULL,
    "trackingId" VARCHAR(32) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" UUID NOT NULL,
    "priority" "ComplaintPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "ComplaintStatus" NOT NULL DEFAULT 'SUBMITTED',
    "citizenId" UUID,
    "assignedDepartmentId" UUID,
    "assignedOfficialId" UUID,
    "locationAddress" TEXT NOT NULL,
    "locality" VARCHAR(255) NOT NULL,
    "ward" VARCHAR(100),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "rejectionReason" TEXT,
    "resolutionNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "civic_works" (
    "id" UUID NOT NULL,
    "workOrderNumber" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "workType" VARCHAR(100) NOT NULL,
    "departmentId" UUID NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "ward" VARCHAR(100),
    "estimatedBudget" DECIMAL(14,2) NOT NULL,
    "sanctionedAmount" DECIMAL(14,2),
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "workStatus" "CivicWorkStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "civic_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "civic_work_complaints" (
    "id" UUID NOT NULL,
    "civicWorkId" UUID NOT NULL,
    "complaintId" UUID NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "civic_work_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_inspections" (
    "id" UUID NOT NULL,
    "complaintId" UUID,
    "civicWorkId" UUID,
    "inspectorId" UUID NOT NULL,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" "InspectionOutcome" NOT NULL,
    "observations" TEXT NOT NULL,
    "measurements" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_inspections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technical_assessments" (
    "id" UUID NOT NULL,
    "complaintId" UUID,
    "civicWorkId" UUID,
    "assessorId" UUID NOT NULL,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "technicalFindings" TEXT NOT NULL,
    "requiredWork" TEXT NOT NULL,
    "estimatedScope" TEXT,
    "feasibility" "FeasibilityAssessment" NOT NULL DEFAULT 'FEASIBLE',
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technical_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL,
    "estimateNumber" VARCHAR(64) NOT NULL,
    "civicWorkId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "preparedById" UUID NOT NULL,
    "preparationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_line_items" (
    "id" UUID NOT NULL,
    "estimateId" UUID NOT NULL,
    "itemNumber" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitOfMeasurement" VARCHAR(50) NOT NULL,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_sanctions" (
    "id" UUID NOT NULL,
    "referenceNumber" VARCHAR(64),
    "civicWorkId" UUID NOT NULL,
    "estimateId" UUID,
    "approvalType" "ApprovalType" NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "decisionDate" TIMESTAMP(3),
    "sanctionedAmount" DECIMAL(14,2),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_sanctions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contractors" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "registrationNumber" VARCHAR(100),
    "contactPerson" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "status" "ContractorStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" UUID NOT NULL,
    "workOrderNumber" VARCHAR(64) NOT NULL,
    "civicWorkId" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "workOrderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contractAmount" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3),
    "expectedCompletionDate" TIMESTAMP(3),
    "actualCompletionDate" TIMESTAMP(3),
    "executionStatus" "ExecutionStatus" NOT NULL DEFAULT 'AWARDED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_progress_updates" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "loggedById" UUID NOT NULL,
    "updateDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "physicalProgressPercentage" DECIMAL(5,2) NOT NULL,
    "financialProgressAmount" DECIMAL(14,2),
    "progressNotes" TEXT NOT NULL,
    "milestoneReached" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_progress_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL,
    "civicWorkId" UUID NOT NULL,
    "recordType" "FinancialRecordType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentDate" TIMESTAMP(3),
    "paymentReference" VARCHAR(100),
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PLANNED',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "documentCategory" "DocumentCategory" NOT NULL,
    "uploaderId" UUID,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "description" TEXT,
    "complaintId" UUID,
    "siteInspectionId" UUID,
    "technicalAssessmentId" UUID,
    "estimateId" UUID,
    "approvalSanctionId" UUID,
    "progressUpdateId" UUID,
    "financialTransactionId" UUID,
    "uploadTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "complaint_status_history" (
    "id" UUID NOT NULL,
    "complaintId" UUID NOT NULL,
    "fromStatus" "ComplaintStatus",
    "toStatus" "ComplaintStatus" NOT NULL,
    "changedById" UUID,
    "reasonOrRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "actorId" UUID,
    "details" JSONB,
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_categories_code_key" ON "complaint_categories"("code");

-- CreateIndex
CREATE INDEX "complaint_categories_departmentId_idx" ON "complaint_categories"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "complaints_trackingId_key" ON "complaints"("trackingId");

-- CreateIndex
CREATE INDEX "complaints_trackingId_idx" ON "complaints"("trackingId");

-- CreateIndex
CREATE INDEX "complaints_status_idx" ON "complaints"("status");

-- CreateIndex
CREATE INDEX "complaints_categoryId_idx" ON "complaints"("categoryId");

-- CreateIndex
CREATE INDEX "complaints_citizenId_idx" ON "complaints"("citizenId");

-- CreateIndex
CREATE INDEX "complaints_assignedDepartmentId_idx" ON "complaints"("assignedDepartmentId");

-- CreateIndex
CREATE INDEX "complaints_assignedOfficialId_idx" ON "complaints"("assignedOfficialId");

-- CreateIndex
CREATE INDEX "complaints_createdAt_idx" ON "complaints"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "civic_works_workOrderNumber_key" ON "civic_works"("workOrderNumber");

-- CreateIndex
CREATE INDEX "civic_works_workOrderNumber_idx" ON "civic_works"("workOrderNumber");

-- CreateIndex
CREATE INDEX "civic_works_departmentId_idx" ON "civic_works"("departmentId");

-- CreateIndex
CREATE INDEX "civic_works_workStatus_idx" ON "civic_works"("workStatus");

-- CreateIndex
CREATE INDEX "civic_work_complaints_civicWorkId_idx" ON "civic_work_complaints"("civicWorkId");

-- CreateIndex
CREATE INDEX "civic_work_complaints_complaintId_idx" ON "civic_work_complaints"("complaintId");

-- CreateIndex
CREATE UNIQUE INDEX "civic_work_complaints_civicWorkId_complaintId_key" ON "civic_work_complaints"("civicWorkId", "complaintId");

-- CreateIndex
CREATE INDEX "site_inspections_complaintId_idx" ON "site_inspections"("complaintId");

-- CreateIndex
CREATE INDEX "site_inspections_civicWorkId_idx" ON "site_inspections"("civicWorkId");

-- CreateIndex
CREATE INDEX "site_inspections_inspectorId_idx" ON "site_inspections"("inspectorId");

-- CreateIndex
CREATE INDEX "technical_assessments_complaintId_idx" ON "technical_assessments"("complaintId");

-- CreateIndex
CREATE INDEX "technical_assessments_civicWorkId_idx" ON "technical_assessments"("civicWorkId");

-- CreateIndex
CREATE INDEX "technical_assessments_assessorId_idx" ON "technical_assessments"("assessorId");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimateNumber_key" ON "estimates"("estimateNumber");

-- CreateIndex
CREATE INDEX "estimates_estimateNumber_idx" ON "estimates"("estimateNumber");

-- CreateIndex
CREATE INDEX "estimates_civicWorkId_idx" ON "estimates"("civicWorkId");

-- CreateIndex
CREATE INDEX "estimates_preparedById_idx" ON "estimates"("preparedById");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_civicWorkId_version_key" ON "estimates"("civicWorkId", "version");

-- CreateIndex
CREATE INDEX "estimate_line_items_estimateId_idx" ON "estimate_line_items"("estimateId");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_line_items_estimateId_itemNumber_key" ON "estimate_line_items"("estimateId", "itemNumber");

-- CreateIndex
CREATE UNIQUE INDEX "approval_sanctions_referenceNumber_key" ON "approval_sanctions"("referenceNumber");

-- CreateIndex
CREATE INDEX "approval_sanctions_civicWorkId_idx" ON "approval_sanctions"("civicWorkId");

-- CreateIndex
CREATE INDEX "approval_sanctions_estimateId_idx" ON "approval_sanctions"("estimateId");

-- CreateIndex
CREATE INDEX "approval_sanctions_approverId_idx" ON "approval_sanctions"("approverId");

-- CreateIndex
CREATE INDEX "approval_sanctions_decision_idx" ON "approval_sanctions"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "contractors_registrationNumber_key" ON "contractors"("registrationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_workOrderNumber_key" ON "work_orders"("workOrderNumber");

-- CreateIndex
CREATE INDEX "work_orders_civicWorkId_idx" ON "work_orders"("civicWorkId");

-- CreateIndex
CREATE INDEX "work_orders_contractorId_idx" ON "work_orders"("contractorId");

-- CreateIndex
CREATE INDEX "work_orders_executionStatus_idx" ON "work_orders"("executionStatus");

-- CreateIndex
CREATE INDEX "execution_progress_updates_workOrderId_idx" ON "execution_progress_updates"("workOrderId");

-- CreateIndex
CREATE INDEX "execution_progress_updates_loggedById_idx" ON "execution_progress_updates"("loggedById");

-- CreateIndex
CREATE INDEX "financial_transactions_civicWorkId_idx" ON "financial_transactions"("civicWorkId");

-- CreateIndex
CREATE INDEX "financial_transactions_recordType_idx" ON "financial_transactions"("recordType");

-- CreateIndex
CREATE INDEX "financial_transactions_paymentStatus_idx" ON "financial_transactions"("paymentStatus");

-- CreateIndex
CREATE INDEX "documents_complaintId_idx" ON "documents"("complaintId");

-- CreateIndex
CREATE INDEX "documents_siteInspectionId_idx" ON "documents"("siteInspectionId");

-- CreateIndex
CREATE INDEX "documents_technicalAssessmentId_idx" ON "documents"("technicalAssessmentId");

-- CreateIndex
CREATE INDEX "documents_estimateId_idx" ON "documents"("estimateId");

-- CreateIndex
CREATE INDEX "documents_approvalSanctionId_idx" ON "documents"("approvalSanctionId");

-- CreateIndex
CREATE INDEX "documents_progressUpdateId_idx" ON "documents"("progressUpdateId");

-- CreateIndex
CREATE INDEX "documents_financialTransactionId_idx" ON "documents"("financialTransactionId");

-- CreateIndex
CREATE INDEX "documents_documentCategory_idx" ON "documents"("documentCategory");

-- CreateIndex
CREATE INDEX "documents_visibility_idx" ON "documents"("visibility");

-- CreateIndex
CREATE INDEX "complaint_status_history_complaintId_idx" ON "complaint_status_history"("complaintId");

-- CreateIndex
CREATE INDEX "complaint_status_history_createdAt_idx" ON "complaint_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "audit_events_entityType_entityId_idx" ON "audit_events"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_events_actorId_idx" ON "audit_events"("actorId");

-- CreateIndex
CREATE INDEX "audit_events_createdAt_idx" ON "audit_events"("createdAt");

-- AddForeignKey
ALTER TABLE "complaint_categories" ADD CONSTRAINT "complaint_categories_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "complaint_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignedDepartmentId_fkey" FOREIGN KEY ("assignedDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_assignedOfficialId_fkey" FOREIGN KEY ("assignedOfficialId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "civic_works" ADD CONSTRAINT "civic_works_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "civic_work_complaints" ADD CONSTRAINT "civic_work_complaints_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "civic_work_complaints" ADD CONSTRAINT "civic_work_complaints_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_inspections" ADD CONSTRAINT "site_inspections_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_inspections" ADD CONSTRAINT "site_inspections_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_inspections" ADD CONSTRAINT "site_inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_assessments" ADD CONSTRAINT "technical_assessments_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_assessments" ADD CONSTRAINT "technical_assessments_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technical_assessments" ADD CONSTRAINT "technical_assessments_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_line_items" ADD CONSTRAINT "estimate_line_items_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_sanctions" ADD CONSTRAINT "approval_sanctions_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_sanctions" ADD CONSTRAINT "approval_sanctions_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_sanctions" ADD CONSTRAINT "approval_sanctions_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_progress_updates" ADD CONSTRAINT "execution_progress_updates_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_progress_updates" ADD CONSTRAINT "execution_progress_updates_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_siteInspectionId_fkey" FOREIGN KEY ("siteInspectionId") REFERENCES "site_inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_technicalAssessmentId_fkey" FOREIGN KEY ("technicalAssessmentId") REFERENCES "technical_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_approvalSanctionId_fkey" FOREIGN KEY ("approvalSanctionId") REFERENCES "approval_sanctions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_progressUpdateId_fkey" FOREIGN KEY ("progressUpdateId") REFERENCES "execution_progress_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "financial_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_status_history" ADD CONSTRAINT "complaint_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

