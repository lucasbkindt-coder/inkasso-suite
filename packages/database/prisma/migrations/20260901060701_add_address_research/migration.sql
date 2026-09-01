-- CreateEnum
CREATE TYPE "AddressResearchStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'RESULT_AVAILABLE', 'NO_RESULT', 'REVIEW_REQUIRED', 'APPLIED', 'CANCELLED', 'ERROR');

-- CreateEnum
CREATE TYPE "AddressResearchReason" AS ENUM ('UNKNOWN_ADDRESS', 'RETURNED_MAIL', 'MOVED', 'ADDRESS_UNCONFIRMED', 'ENFORCEMENT_PREPARATION', 'OTHER');

-- CreateEnum
CREATE TYPE "AddressResearchProviderType" AS ENUM ('MANUAL', 'MOCK');

-- CreateEnum
CREATE TYPE "AddressResearchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'ADDRESS_RESEARCH_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'ADDRESS_RESEARCH_RESULT_ADDED';
ALTER TYPE "ActivityEventType" ADD VALUE 'ADDRESS_RESEARCH_NO_RESULT';
ALTER TYPE "ActivityEventType" ADD VALUE 'ADDRESS_RESEARCH_RESULT_SELECTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'ADDRESS_RESEARCH_ADDRESS_APPLIED';
ALTER TYPE "ActivityEventType" ADD VALUE 'ADDRESS_RESEARCH_CANCELLED';

-- CreateTable
CREATE TABLE "AddressResearchRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "caseId" UUID,
    "status" "AddressResearchStatus" NOT NULL DEFAULT 'CREATED',
    "reason" "AddressResearchReason",
    "provider" "AddressResearchProviderType" NOT NULL DEFAULT 'MANUAL',
    "externalReference" TEXT,
    "requestedByMembershipId" UUID NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "selectedResultId" UUID,
    "costAmount" DECIMAL(15,2),
    "costCurrency" CHAR(3),
    "notes" TEXT,
    "originalAddressId" UUID,
    "originalStreet" TEXT,
    "originalHouseNumber" TEXT,
    "originalAddressLine2" TEXT,
    "originalPostalCode" TEXT,
    "originalCity" TEXT,
    "originalCountry" CHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressResearchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddressResearchResult" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "researchRequestId" UUID NOT NULL,
    "street" TEXT NOT NULL,
    "houseNumber" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'DE',
    "additionalAddressLine" TEXT,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT,
    "sourceDate" TIMESTAMP(3),
    "confidence" "AddressResearchConfidence" NOT NULL,
    "qualityReason" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" TIMESTAMP(3),
    "appliedByMembershipId" UUID,
    "rawProviderData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AddressResearchResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AddressResearchRequest_selectedResultId_key" ON "AddressResearchRequest"("selectedResultId");

-- CreateIndex
CREATE INDEX "AddressResearchRequest_tenantId_status_requestedAt_idx" ON "AddressResearchRequest"("tenantId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "AddressResearchRequest_tenantId_partyId_requestedAt_idx" ON "AddressResearchRequest"("tenantId", "partyId", "requestedAt");

-- CreateIndex
CREATE INDEX "AddressResearchRequest_tenantId_caseId_requestedAt_idx" ON "AddressResearchRequest"("tenantId", "caseId", "requestedAt");

-- CreateIndex
CREATE INDEX "AddressResearchRequest_requestedByMembershipId_idx" ON "AddressResearchRequest"("requestedByMembershipId");

-- CreateIndex
CREATE INDEX "AddressResearchResult_tenantId_researchRequestId_createdAt_idx" ON "AddressResearchResult"("tenantId", "researchRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "AddressResearchResult_appliedByMembershipId_idx" ON "AddressResearchResult"("appliedByMembershipId");

-- AddForeignKey
ALTER TABLE "AddressResearchRequest" ADD CONSTRAINT "AddressResearchRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchRequest" ADD CONSTRAINT "AddressResearchRequest_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchRequest" ADD CONSTRAINT "AddressResearchRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchRequest" ADD CONSTRAINT "AddressResearchRequest_requestedByMembershipId_fkey" FOREIGN KEY ("requestedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchRequest" ADD CONSTRAINT "AddressResearchRequest_originalAddressId_fkey" FOREIGN KEY ("originalAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchRequest" ADD CONSTRAINT "AddressResearchRequest_selectedResultId_fkey" FOREIGN KEY ("selectedResultId") REFERENCES "AddressResearchResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchResult" ADD CONSTRAINT "AddressResearchResult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchResult" ADD CONSTRAINT "AddressResearchResult_researchRequestId_fkey" FOREIGN KEY ("researchRequestId") REFERENCES "AddressResearchRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddressResearchResult" ADD CONSTRAINT "AddressResearchResult_appliedByMembershipId_fkey" FOREIGN KEY ("appliedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
