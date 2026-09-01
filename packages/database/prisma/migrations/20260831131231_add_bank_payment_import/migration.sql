-- CreateEnum
CREATE TYPE "BankFileFormat" AS ENUM ('CAMT_053', 'CAMT_054');

-- CreateEnum
CREATE TYPE "BankImportStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'COMPLETED_WITH_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "BankTransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('IMPORTED', 'MATCHED', 'BOOKED', 'REVIEW_REQUIRED', 'DUPLICATE', 'IGNORED', 'ERROR', 'PAYMENT_REVERSED');

ALTER TYPE "ActivityEventType" ADD VALUE 'BANK_IMPORT_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'BANK_TRANSACTION_AUTO_MATCHED';
ALTER TYPE "ActivityEventType" ADD VALUE 'BANK_TRANSACTION_REVIEW_REQUIRED';
ALTER TYPE "ActivityEventType" ADD VALUE 'BANK_TRANSACTION_MANUALLY_MATCHED';
ALTER TYPE "ActivityEventType" ADD VALUE 'BANK_TRANSACTION_BOOKED';
ALTER TYPE "ActivityEventType" ADD VALUE 'BANK_TRANSACTION_IGNORED';

-- CreateTable
CREATE TABLE "BankImport" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" "BankFileFormat" NOT NULL,
    "fileHash" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "BankImportStatus" NOT NULL DEFAULT 'PROCESSING',
    "importedByMembershipId" UUID NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "bankImportId" UUID NOT NULL,
    "externalTransactionId" TEXT,
    "bookingDate" DATE NOT NULL,
    "valueDate" DATE,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "direction" "BankTransactionDirection" NOT NULL,
    "debtorName" TEXT,
    "debtorIban" TEXT,
    "creditorName" TEXT,
    "creditorIban" TEXT,
    "purpose" TEXT NOT NULL,
    "bankReference" TEXT,
    "endToEndId" TEXT,
    "mandateReference" TEXT,
    "creditorReference" TEXT,
    "bankTransactionCode" TEXT,
    "transactionKey" TEXT NOT NULL,
    "normalizedData" JSONB,
    "status" "BankTransactionStatus" NOT NULL DEFAULT 'IMPORTED',
    "matchedCaseId" UUID,
    "matchedPartyId" UUID,
    "paymentId" UUID,
    "duplicateOfId" UUID,
    "matchScore" INTEGER,
    "matchReason" TEXT,
    "ignoreReason" TEXT,
    "reviewedByMembershipId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankImport_tenantId_importedAt_idx" ON "BankImport"("tenantId", "importedAt");

-- CreateIndex
CREATE INDEX "BankImport_tenantId_status_importedAt_idx" ON "BankImport"("tenantId", "status", "importedAt");

-- CreateIndex
CREATE INDEX "BankImport_importedByMembershipId_idx" ON "BankImport"("importedByMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "BankImport_tenantId_fileHash_key" ON "BankImport"("tenantId", "fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_paymentId_key" ON "BankTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_status_bookingDate_idx" ON "BankTransaction"("tenantId", "status", "bookingDate");

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_bankImportId_status_idx" ON "BankTransaction"("tenantId", "bankImportId", "status");

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_transactionKey_idx" ON "BankTransaction"("tenantId", "transactionKey");

-- A normalized bank transaction may have one canonical row per tenant. Rows
-- explicitly marked as duplicates remain auditable without becoming bookable.
CREATE UNIQUE INDEX "BankTransaction_canonical_transaction_key"
ON "BankTransaction"("tenantId", "transactionKey")
WHERE "status" <> 'DUPLICATE';

-- CreateIndex
CREATE INDEX "BankTransaction_tenantId_externalTransactionId_idx" ON "BankTransaction"("tenantId", "externalTransactionId");

-- CreateIndex
CREATE INDEX "BankTransaction_matchedCaseId_idx" ON "BankTransaction"("matchedCaseId");

-- CreateIndex
CREATE INDEX "BankTransaction_matchedPartyId_idx" ON "BankTransaction"("matchedPartyId");

-- CreateIndex
CREATE INDEX "BankTransaction_reviewedByMembershipId_idx" ON "BankTransaction"("reviewedByMembershipId");

-- CreateIndex
CREATE INDEX "BankTransaction_duplicateOfId_idx" ON "BankTransaction"("duplicateOfId");

-- AddForeignKey
ALTER TABLE "BankImport" ADD CONSTRAINT "BankImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankImport" ADD CONSTRAINT "BankImport_importedByMembershipId_fkey" FOREIGN KEY ("importedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_bankImportId_fkey" FOREIGN KEY ("bankImportId") REFERENCES "BankImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedCaseId_fkey" FOREIGN KEY ("matchedCaseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_matchedPartyId_fkey" FOREIGN KEY ("matchedPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CaseLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_reviewedByMembershipId_fkey" FOREIGN KEY ("reviewedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
