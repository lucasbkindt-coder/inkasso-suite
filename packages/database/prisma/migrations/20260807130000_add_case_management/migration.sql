-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CasePhase" AS ENUM ('NEW', 'PRE_COLLECTION', 'OUT_OF_COURT', 'PAYMENT_PLAN', 'JUDICIAL_DUNNING', 'LITIGATION', 'ENFORCEMENT', 'MONITORING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'DISPUTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Case" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "sequenceYear" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "clientPartyId" UUID NOT NULL,
    "debtorPartyId" UUID NOT NULL,
    "ownerMembershipId" UUID,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "phase" "CasePhase" NOT NULL DEFAULT 'NEW',
    "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "defaultDate" DATE,
    "principalAmount" DECIMAL(15,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "description" TEXT,
    "status" "ClaimStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseNumberSequence" (
    "tenantId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseNumberSequence_pkey" PRIMARY KEY ("tenantId","year")
);

-- CreateIndex
CREATE INDEX "Case_tenantId_status_deletedAt_idx" ON "Case"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "Case_tenantId_phase_deletedAt_idx" ON "Case"("tenantId", "phase", "deletedAt");

-- CreateIndex
CREATE INDEX "Case_clientPartyId_idx" ON "Case"("clientPartyId");

-- CreateIndex
CREATE INDEX "Case_debtorPartyId_idx" ON "Case"("debtorPartyId");

-- CreateIndex
CREATE INDEX "Case_ownerMembershipId_idx" ON "Case"("ownerMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Case_tenantId_caseNumber_key" ON "Case"("tenantId", "caseNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Case_tenantId_sequenceYear_sequenceNumber_key" ON "Case"("tenantId", "sequenceYear", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_caseId_key" ON "Claim"("caseId");

-- CreateIndex
CREATE INDEX "Claim_tenantId_status_deletedAt_idx" ON "Claim"("tenantId", "status", "deletedAt");

-- CreateIndex
CREATE INDEX "Claim_tenantId_invoiceNumber_idx" ON "Claim"("tenantId", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_debtorPartyId_fkey" FOREIGN KEY ("debtorPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_ownerMembershipId_fkey" FOREIGN KEY ("ownerMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseNumberSequence" ADD CONSTRAINT "CaseNumberSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
