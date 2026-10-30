-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNDER_EVALUATION', 'AWARDED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "WorkStartStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED_REVISION_REQUIRED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DefectStatus" AS ENUM ('REPORTED', 'INSPECTED', 'RECTIFICATION_IN_PROGRESS', 'RECTIFIED_VERIFIED', 'CLOSED', 'DISPUTED');

-- AlterEnum
ALTER TYPE "DocumentCategory" ADD VALUE 'TENDER_DOCUMENT';
ALTER TYPE "DocumentCategory" ADD VALUE 'BID_PROPOSAL';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'TENDER_PUBLISHED';
ALTER TYPE "NotificationType" ADD VALUE 'BID_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'BID_EVALUATED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_AWARDED';
ALTER TYPE "NotificationType" ADD VALUE 'WORK_START_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'WORK_START_VERIFIED';
ALTER TYPE "NotificationType" ADD VALUE 'MILESTONE_CLAIMED';
ALTER TYPE "NotificationType" ADD VALUE 'MILESTONE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'MILESTONE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RECORDED';
ALTER TYPE "NotificationType" ADD VALUE 'DEFECT_REPORTED';
ALTER TYPE "NotificationType" ADD VALUE 'DEFECT_RECTIFIED';

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CONTRACTOR';

-- AlterTable
ALTER TABLE "contractors" ADD COLUMN "businessAddress" TEXT,
ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "licenseClass" VARCHAR(50) DEFAULT 'CLASS_B',
ADD COLUMN "operatingRegion" VARCHAR(255),
ADD COLUMN "panOrTaxId" VARCHAR(50),
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedById" UUID,
ADD COLUMN "workCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "defectRequestId" UUID,
ADD COLUMN "milestoneId" UUID,
ADD COLUMN "tenderBidId" UUID,
ADD COLUMN "tenderId" UUID,
ADD COLUMN "workStartId" UUID;

-- AlterTable
ALTER TABLE "financial_transactions" ADD COLUMN "contractorId" UUID,
ADD COLUMN "workOrderId" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "contractorId" UUID;

-- AlterTable
ALTER TABLE "work_orders" ADD COLUMN "tenderBidId" UUID,
ADD COLUMN "tenderId" UUID;

-- CreateTable
CREATE TABLE "tenders" (
    "id" UUID NOT NULL,
    "tenderNumber" VARCHAR(64) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "departmentId" UUID NOT NULL,
    "civicWorkId" UUID,
    "categoryCode" VARCHAR(50) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "ward" VARCHAR(100),
    "estimatedBudget" DECIMAL(14,2) NOT NULL,
    "earnestMoneyDeposit" DECIMAL(14,2),
    "minimumContractorClass" VARCHAR(50) DEFAULT 'ANY',
    "status" "TenderStatus" NOT NULL DEFAULT 'DRAFT',
    "publicationDate" TIMESTAMP(3),
    "submissionDeadline" TIMESTAMP(3) NOT NULL,
    "expectedDurationDays" INTEGER,
    "eligibilityCriteria" TEXT,
    "scopeOfWork" TEXT,
    "createdById" UUID NOT NULL,
    "awardedBidId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tender_bids" (
    "id" UUID NOT NULL,
    "bidNumber" VARCHAR(64) NOT NULL,
    "tenderId" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "bidAmount" DECIMAL(14,2) NOT NULL,
    "proposedDurationDays" INTEGER NOT NULL,
    "technicalProposal" TEXT NOT NULL,
    "methodology" TEXT,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT true,
    "status" "BidStatus" NOT NULL DEFAULT 'SUBMITTED',
    "officialEvaluationNotes" TEXT,
    "evaluatedById" UUID,
    "evaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tender_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_start_declarations" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "submittedById" UUID NOT NULL,
    "declaredStartDate" TIMESTAMP(3) NOT NULL,
    "siteAddress" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "siteNotes" TEXT NOT NULL,
    "status" "WorkStartStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_start_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_milestones" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "milestoneNumber" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "targetPhysicalPercentage" DECIMAL(5,2) NOT NULL,
    "targetAmount" DECIMAL(14,2),
    "targetDueDate" TIMESTAMP(3),
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "claimedDate" TIMESTAMP(3),
    "claimedPhysicalPercentage" DECIMAL(5,2),
    "claimedNotes" TEXT,
    "claimedById" UUID,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewerRemarks" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "defect_warranty_requests" (
    "id" UUID NOT NULL,
    "trackingId" VARCHAR(32) NOT NULL,
    "workOrderId" UUID NOT NULL,
    "contractorId" UUID NOT NULL,
    "reportedById" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "severity" VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    "status" "DefectStatus" NOT NULL DEFAULT 'REPORTED',
    "isWarrantyCovered" BOOLEAN NOT NULL DEFAULT true,
    "rectificationNotes" TEXT,
    "rectifiedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "closureRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "defect_warranty_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenders_tenderNumber_key" ON "tenders"("tenderNumber");
CREATE UNIQUE INDEX "tenders_awardedBidId_key" ON "tenders"("awardedBidId");
CREATE INDEX "tenders_tenderNumber_idx" ON "tenders"("tenderNumber");
CREATE INDEX "tenders_status_idx" ON "tenders"("status");
CREATE INDEX "tenders_departmentId_idx" ON "tenders"("departmentId");
CREATE INDEX "tenders_civicWorkId_idx" ON "tenders"("civicWorkId");
CREATE INDEX "tenders_categoryCode_idx" ON "tenders"("categoryCode");
CREATE INDEX "tenders_submissionDeadline_idx" ON "tenders"("submissionDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "tender_bids_bidNumber_key" ON "tender_bids"("bidNumber");
CREATE INDEX "tender_bids_tenderId_idx" ON "tender_bids"("tenderId");
CREATE INDEX "tender_bids_contractorId_idx" ON "tender_bids"("contractorId");
CREATE INDEX "tender_bids_submittedById_idx" ON "tender_bids"("submittedById");
CREATE INDEX "tender_bids_status_idx" ON "tender_bids"("status");
CREATE UNIQUE INDEX "tender_bids_tenderId_contractorId_key" ON "tender_bids"("tenderId", "contractorId");

-- CreateIndex
CREATE INDEX "work_start_declarations_workOrderId_idx" ON "work_start_declarations"("workOrderId");
CREATE INDEX "work_start_declarations_contractorId_idx" ON "work_start_declarations"("contractorId");
CREATE INDEX "work_start_declarations_status_idx" ON "work_start_declarations"("status");

-- CreateIndex
CREATE INDEX "contract_milestones_workOrderId_idx" ON "contract_milestones"("workOrderId");
CREATE INDEX "contract_milestones_status_idx" ON "contract_milestones"("status");
CREATE UNIQUE INDEX "contract_milestones_workOrderId_milestoneNumber_key" ON "contract_milestones"("workOrderId", "milestoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "defect_warranty_requests_trackingId_key" ON "defect_warranty_requests"("trackingId");
CREATE INDEX "defect_warranty_requests_trackingId_idx" ON "defect_warranty_requests"("trackingId");
CREATE INDEX "defect_warranty_requests_workOrderId_idx" ON "defect_warranty_requests"("workOrderId");
CREATE INDEX "defect_warranty_requests_contractorId_idx" ON "defect_warranty_requests"("contractorId");
CREATE INDEX "defect_warranty_requests_status_idx" ON "defect_warranty_requests"("status");

-- CreateIndex
CREATE INDEX "documents_tenderId_idx" ON "documents"("tenderId");
CREATE INDEX "documents_tenderBidId_idx" ON "documents"("tenderBidId");
CREATE INDEX "documents_workStartId_idx" ON "documents"("workStartId");
CREATE INDEX "documents_milestoneId_idx" ON "documents"("milestoneId");
CREATE INDEX "documents_defectRequestId_idx" ON "documents"("defectRequestId");

-- CreateIndex
CREATE INDEX "financial_transactions_workOrderId_idx" ON "financial_transactions"("workOrderId");
CREATE INDEX "financial_transactions_contractorId_idx" ON "financial_transactions"("contractorId");

-- CreateIndex
CREATE INDEX "users_contractorId_idx" ON "users"("contractorId");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_tenderBidId_key" ON "work_orders"("tenderBidId");
CREATE INDEX "work_orders_tenderId_idx" ON "work_orders"("tenderId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenderBidId_fkey" FOREIGN KEY ("tenderBidId") REFERENCES "tender_bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenderBidId_fkey" FOREIGN KEY ("tenderBidId") REFERENCES "tender_bids"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_workStartId_fkey" FOREIGN KEY ("workStartId") REFERENCES "work_start_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "contract_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_defectRequestId_fkey" FOREIGN KEY ("defectRequestId") REFERENCES "defect_warranty_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_civicWorkId_fkey" FOREIGN KEY ("civicWorkId") REFERENCES "civic_works"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_awardedBidId_fkey" FOREIGN KEY ("awardedBidId") REFERENCES "tender_bids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tender_bids" ADD CONSTRAINT "tender_bids_evaluatedById_fkey" FOREIGN KEY ("evaluatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_start_declarations" ADD CONSTRAINT "work_start_declarations_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_start_declarations" ADD CONSTRAINT "work_start_declarations_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_start_declarations" ADD CONSTRAINT "work_start_declarations_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_start_declarations" ADD CONSTRAINT "work_start_declarations_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_milestones" ADD CONSTRAINT "contract_milestones_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_warranty_requests" ADD CONSTRAINT "defect_warranty_requests_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_warranty_requests" ADD CONSTRAINT "defect_warranty_requests_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_warranty_requests" ADD CONSTRAINT "defect_warranty_requests_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "defect_warranty_requests" ADD CONSTRAINT "defect_warranty_requests_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
