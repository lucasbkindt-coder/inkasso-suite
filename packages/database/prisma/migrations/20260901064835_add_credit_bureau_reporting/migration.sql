-- CreateEnum
CREATE TYPE "ClaimDisputeStatus" AS ENUM ('NONE', 'DISPUTED', 'PARTIALLY_DISPUTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CreditBureauProvider" AS ENUM ('MANUAL', 'MOCK', 'SCHUFA', 'EXPERIAN', 'CREDITREFORM', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditBureauReportStatus" AS ENUM ('DRAFT', 'ELIGIBILITY_REVIEW', 'ELIGIBLE', 'NOT_ELIGIBLE', 'APPROVED', 'READY_FOR_SUBMISSION', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'UPDATED', 'SETTLED', 'REVOKED', 'CANCELLED', 'ERROR');

-- CreateEnum
CREATE TYPE "CreditBureauEligibilityStatus" AS ENUM ('PENDING', 'ELIGIBLE', 'NOT_ELIGIBLE', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "CreditBureauReportEventType" AS ENUM ('CREATED', 'ELIGIBILITY_CHECKED', 'APPROVED', 'APPROVAL_REVOKED', 'STATUS_CHANGED', 'APPROVAL_STALE', 'SETTLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'CREDIT_REPORT_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CREDIT_REPORT_ELIGIBILITY_CHECKED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CREDIT_REPORT_APPROVED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CREDIT_REPORT_APPROVAL_REVOKED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CREDIT_REPORT_STATUS_CHANGED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CREDIT_REPORT_SETTLED';

-- AlterEnum
ALTER TYPE "DataSubjectDataCategory" ADD VALUE 'CREDIT_REPORTING';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "disputeStatus" "ClaimDisputeStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "CreditBureauReport" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "provider" "CreditBureauProvider" NOT NULL,
    "status" "CreditBureauReportStatus" NOT NULL DEFAULT 'DRAFT',
    "eligibilityStatus" "CreditBureauEligibilityStatus" NOT NULL DEFAULT 'PENDING',
    "eligibilityReason" TEXT,
    "eligibilityDetails" JSONB,
    "eligibilityCheckedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByMembershipId" UUID,
    "approvalReason" TEXT,
    "approvalSnapshot" JSONB,
    "approvalStaleAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "externalReference" TEXT,
    "reportedAmount" DECIMAL(15,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "settledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "activeKey" TEXT,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditBureauReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditBureauReportEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "eventType" "CreditBureauReportEventType" NOT NULL,
    "statusBefore" "CreditBureauReportStatus",
    "statusAfter" "CreditBureauReportStatus",
    "actorMembershipId" UUID,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditBureauReportEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditBureauReport_activeKey_key" ON "CreditBureauReport"("activeKey");

-- CreateIndex
CREATE INDEX "CreditBureauReport_tenantId_status_updatedAt_idx" ON "CreditBureauReport"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CreditBureauReport_tenantId_partyId_updatedAt_idx" ON "CreditBureauReport"("tenantId", "partyId", "updatedAt");

-- CreateIndex
CREATE INDEX "CreditBureauReport_tenantId_caseId_provider_idx" ON "CreditBureauReport"("tenantId", "caseId", "provider");

-- CreateIndex
CREATE INDEX "CreditBureauReport_approvedByMembershipId_idx" ON "CreditBureauReport"("approvedByMembershipId");

-- CreateIndex
CREATE INDEX "CreditBureauReport_createdByMembershipId_idx" ON "CreditBureauReport"("createdByMembershipId");

-- CreateIndex
CREATE INDEX "CreditBureauReportEvent_tenantId_reportId_createdAt_idx" ON "CreditBureauReportEvent"("tenantId", "reportId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditBureauReportEvent_actorMembershipId_idx" ON "CreditBureauReportEvent"("actorMembershipId");

-- AddForeignKey
ALTER TABLE "CreditBureauReport" ADD CONSTRAINT "CreditBureauReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBureauReport" ADD CONSTRAINT "CreditBureauReport_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBureauReport" ADD CONSTRAINT "CreditBureauReport_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBureauReport" ADD CONSTRAINT "CreditBureauReport_approvedByMembershipId_fkey" FOREIGN KEY ("approvedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBureauReport" ADD CONSTRAINT "CreditBureauReport_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBureauReportEvent" ADD CONSTRAINT "CreditBureauReportEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBureauReportEvent" ADD CONSTRAINT "CreditBureauReportEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "CreditBureauReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditBureauReportEvent" ADD CONSTRAINT "CreditBureauReportEvent_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
