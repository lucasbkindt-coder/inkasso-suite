-- CreateEnum
CREATE TYPE "EnforcementTitleType" AS ENUM ('ENFORCEMENT_ORDER', 'JUDGMENT', 'COST_ASSESSMENT_ORDER', 'SETTLEMENT', 'NOTARIAL_DEED', 'OTHER');

-- CreateEnum
CREATE TYPE "EnforcementTitleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SATISFIED', 'VOIDED');

-- CreateEnum
CREATE TYPE "EnforcementActionType" AS ENUM ('BAILIFF_ORDER', 'ASSET_DISCLOSURE', 'GARNISHMENT', 'ACCOUNT_GARNISHMENT', 'WAGE_GARNISHMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EnforcementActionStatus" AS ENUM ('DRAFT', 'PREPARED', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'TITLE_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TITLE_ACTIVATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TITLE_VOIDED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TITLE_SATISFIED';
ALTER TYPE "ActivityEventType" ADD VALUE 'ENFORCEMENT_ACTION_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'ENFORCEMENT_ACTION_STATUS_CHANGED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentType" ADD VALUE 'TITLE_NOTIFICATION';
ALTER TYPE "DocumentType" ADD VALUE 'CASE_SETTLED';
ALTER TYPE "DocumentType" ADD VALUE 'CLAIM_STATEMENT';
ALTER TYPE "DocumentType" ADD VALUE 'ENFORCEMENT_ORDER';
ALTER TYPE "DocumentType" ADD VALUE 'ENFORCEMENT_COVER_LETTER';
ALTER TYPE "DocumentType" ADD VALUE 'GARNISHMENT_APPLICATION';
ALTER TYPE "DocumentType" ADD VALUE 'PAYMENT_CONFIRMATION';

-- CreateTable
CREATE TABLE "EnforcementTitle" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "EnforcementTitleType" NOT NULL,
    "status" "EnforcementTitleStatus" NOT NULL DEFAULT 'DRAFT',
    "courtOrAuthority" TEXT,
    "referenceNumber" TEXT,
    "titleDate" TIMESTAMP(3) NOT NULL,
    "serviceDate" TIMESTAMP(3),
    "enforceableFrom" TIMESTAMP(3),
    "principalAmount" DECIMAL(15,2) NOT NULL,
    "costAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "interestAmount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "interestRule" JSONB,
    "titleTotal" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnforcementTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnforcementAction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "titleId" UUID NOT NULL,
    "type" "EnforcementActionType" NOT NULL,
    "status" "EnforcementActionStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "referenceNumber" TEXT,
    "amountAtRequest" DECIMAL(15,2) NOT NULL,
    "notes" TEXT,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnforcementAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnforcementTitle_tenantId_caseId_status_idx" ON "EnforcementTitle"("tenantId", "caseId", "status");

-- CreateIndex
CREATE INDEX "EnforcementTitle_caseId_titleDate_idx" ON "EnforcementTitle"("caseId", "titleDate");

-- CreateIndex
CREATE INDEX "EnforcementTitle_createdByMembershipId_idx" ON "EnforcementTitle"("createdByMembershipId");

-- CreateIndex
CREATE INDEX "EnforcementAction_tenantId_caseId_status_idx" ON "EnforcementAction"("tenantId", "caseId", "status");

-- CreateIndex
CREATE INDEX "EnforcementAction_titleId_status_idx" ON "EnforcementAction"("titleId", "status");

-- CreateIndex
CREATE INDEX "EnforcementAction_createdByMembershipId_idx" ON "EnforcementAction"("createdByMembershipId");

-- AddForeignKey
ALTER TABLE "EnforcementTitle" ADD CONSTRAINT "EnforcementTitle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementTitle" ADD CONSTRAINT "EnforcementTitle_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementTitle" ADD CONSTRAINT "EnforcementTitle_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "EnforcementTitle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementAction" ADD CONSTRAINT "EnforcementAction_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
