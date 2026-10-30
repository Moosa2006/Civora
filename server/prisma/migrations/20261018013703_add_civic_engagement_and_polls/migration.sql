-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_CLARIFICATION', 'PUBLISHED', 'ACCEPTED_FOR_CONSIDERATION', 'DECLINED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PollType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE');

-- CreateEnum
CREATE TYPE "PollVisibilityRule" AS ENUM ('ALWAYS_VISIBLE', 'AFTER_VOTE', 'AFTER_CLOSE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PROPOSAL_SUBMITTED';
ALTER TYPE "NotificationType" ADD VALUE 'PROPOSAL_STATUS_CHANGED';
ALTER TYPE "NotificationType" ADD VALUE 'PROPOSAL_RESPONSE';
ALTER TYPE "NotificationType" ADD VALUE 'POLL_CREATED';

-- CreateTable
CREATE TABLE "community_proposals" (
    "id" UUID NOT NULL,
    "trackingId" VARCHAR(32) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "problemStatement" TEXT,
    "suggestedSolution" TEXT,
    "categoryId" UUID NOT NULL,
    "locality" VARCHAR(255),
    "status" "ProposalStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submitterId" UUID NOT NULL,
    "moderatedById" UUID,
    "moderatedAt" TIMESTAMP(3),
    "internalModerationNotes" TEXT,
    "publicExplanation" TEXT,
    "officialResponse" TEXT,
    "officialResponseById" UUID,
    "officialResponseAt" TIMESTAMP(3),
    "supportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_supports" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_supports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_comments" (
    "id" UUID NOT NULL,
    "proposalId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isModerated" BOOLEAN NOT NULL DEFAULT false,
    "moderationReason" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposal_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_polls" (
    "id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "categoryId" UUID,
    "locality" VARCHAR(255),
    "status" "PollStatus" NOT NULL DEFAULT 'DRAFT',
    "pollType" "PollType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "visibilityRule" "PollVisibilityRule" NOT NULL DEFAULT 'ALWAYS_VISIBLE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isAdvisory" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_options" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "text" VARCHAR(255) NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_participations" (
    "id" UUID NOT NULL,
    "pollId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_participations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_proposals_trackingId_key" ON "community_proposals"("trackingId");

-- CreateIndex
CREATE INDEX "community_proposals_status_idx" ON "community_proposals"("status");

-- CreateIndex
CREATE INDEX "community_proposals_categoryId_idx" ON "community_proposals"("categoryId");

-- CreateIndex
CREATE INDEX "community_proposals_submitterId_idx" ON "community_proposals"("submitterId");

-- CreateIndex
CREATE INDEX "community_proposals_createdAt_idx" ON "community_proposals"("createdAt");

-- CreateIndex
CREATE INDEX "proposal_supports_proposalId_idx" ON "proposal_supports"("proposalId");

-- CreateIndex
CREATE INDEX "proposal_supports_userId_idx" ON "proposal_supports"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_supports_proposalId_userId_key" ON "proposal_supports"("proposalId", "userId");

-- CreateIndex
CREATE INDEX "proposal_comments_proposalId_createdAt_idx" ON "proposal_comments"("proposalId", "createdAt");

-- CreateIndex
CREATE INDEX "proposal_comments_authorId_idx" ON "proposal_comments"("authorId");

-- CreateIndex
CREATE INDEX "public_polls_status_idx" ON "public_polls"("status");

-- CreateIndex
CREATE INDEX "public_polls_startDate_endDate_idx" ON "public_polls"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "public_polls_categoryId_idx" ON "public_polls"("categoryId");

-- CreateIndex
CREATE INDEX "poll_options_pollId_orderIndex_idx" ON "poll_options"("pollId", "orderIndex");

-- CreateIndex
CREATE INDEX "poll_votes_pollId_idx" ON "poll_votes"("pollId");

-- CreateIndex
CREATE INDEX "poll_votes_userId_idx" ON "poll_votes"("userId");

-- CreateIndex
CREATE INDEX "poll_votes_optionId_idx" ON "poll_votes"("optionId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_votes_pollId_userId_optionId_key" ON "poll_votes"("pollId", "userId", "optionId");

-- CreateIndex
CREATE INDEX "poll_participations_pollId_idx" ON "poll_participations"("pollId");

-- CreateIndex
CREATE INDEX "poll_participations_userId_idx" ON "poll_participations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_participations_pollId_userId_key" ON "poll_participations"("pollId", "userId");

-- AddForeignKey
ALTER TABLE "community_proposals" ADD CONSTRAINT "community_proposals_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "complaint_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_proposals" ADD CONSTRAINT "community_proposals_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_proposals" ADD CONSTRAINT "community_proposals_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_proposals" ADD CONSTRAINT "community_proposals_officialResponseById_fkey" FOREIGN KEY ("officialResponseById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_supports" ADD CONSTRAINT "proposal_supports_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "community_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_supports" ADD CONSTRAINT "proposal_supports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "community_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_comments" ADD CONSTRAINT "proposal_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_polls" ADD CONSTRAINT "public_polls_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "complaint_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_polls" ADD CONSTRAINT "public_polls_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_options" ADD CONSTRAINT "poll_options_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "poll_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_participations" ADD CONSTRAINT "poll_participations_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "public_polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_participations" ADD CONSTRAINT "poll_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
