-- CreateEnum
CREATE TYPE "AllocationPolicy" AS ENUM ('BGB_367_DEFAULT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PaymentAllocationStatus" AS ENUM ('ACTIVE', 'REVERSED');

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "paymentEntryId" UUID NOT NULL,
    "targetEntryId" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "policy" "AllocationPolicy" NOT NULL,
    "allocationOrder" INTEGER NOT NULL,
    "status" "PaymentAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAllocation_tenantId_caseId_status_idx" ON "PaymentAllocation"("tenantId", "caseId", "status");

-- CreateIndex
CREATE INDEX "PaymentAllocation_targetEntryId_status_idx" ON "PaymentAllocation"("targetEntryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentEntryId_targetEntryId_key" ON "PaymentAllocation"("paymentEntryId", "targetEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_paymentEntryId_allocationOrder_key" ON "PaymentAllocation"("paymentEntryId", "allocationOrder");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentEntryId_fkey" FOREIGN KEY ("paymentEntryId") REFERENCES "CaseLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_targetEntryId_fkey" FOREIGN KEY ("targetEntryId") REFERENCES "CaseLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
