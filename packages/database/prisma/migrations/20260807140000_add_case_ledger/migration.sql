-- CreateEnum
CREATE TYPE "LedgerEntrySide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PRINCIPAL', 'INTEREST', 'COLLECTION_FEE', 'EXPENSE', 'COURT_COST', 'ENFORCEMENT_COST', 'PAYMENT', 'CREDIT_NOTE', 'CORRECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateTable
CREATE TABLE "CaseLedgerEntry" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "side" "LedgerEntrySide" NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "bookingDate" DATE NOT NULL,
    "valueDate" DATE,
    "description" TEXT NOT NULL,
    "externalReference" TEXT,
    "source" TEXT,
    "reversedEntryId" UUID,
    "createdByMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaseLedgerEntry_reversedEntryId_key" ON "CaseLedgerEntry"("reversedEntryId");

-- CreateIndex
CREATE INDEX "CaseLedgerEntry_tenantId_caseId_bookingDate_idx" ON "CaseLedgerEntry"("tenantId", "caseId", "bookingDate");

-- CreateIndex
CREATE INDEX "CaseLedgerEntry_caseId_status_idx" ON "CaseLedgerEntry"("caseId", "status");

-- CreateIndex
CREATE INDEX "CaseLedgerEntry_type_idx" ON "CaseLedgerEntry"("type");

-- CreateIndex
CREATE INDEX "CaseLedgerEntry_externalReference_idx" ON "CaseLedgerEntry"("externalReference");

-- CreateIndex
CREATE INDEX "CaseLedgerEntry_createdByMembershipId_idx" ON "CaseLedgerEntry"("createdByMembershipId");

-- AddForeignKey
ALTER TABLE "CaseLedgerEntry" ADD CONSTRAINT "CaseLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseLedgerEntry" ADD CONSTRAINT "CaseLedgerEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseLedgerEntry" ADD CONSTRAINT "CaseLedgerEntry_reversedEntryId_fkey" FOREIGN KEY ("reversedEntryId") REFERENCES "CaseLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseLedgerEntry" ADD CONSTRAINT "CaseLedgerEntry_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
