-- CreateEnum
CREATE TYPE "CaseCostCalculationType" AS ENUM ('RVG', 'INTEREST');

-- CreateEnum
CREATE TYPE "CaseCostCalculationStatus" AS ENUM ('APPLIED', 'REVERSED');

-- AlterTable
ALTER TABLE "CaseLedgerEntry" ADD COLUMN     "costCalculationId" UUID;

-- CreateTable
CREATE TABLE "CaseCostCalculation" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "type" "CaseCostCalculationType" NOT NULL,
    "status" "CaseCostCalculationStatus" NOT NULL DEFAULT 'APPLIED',
    "fingerprint" TEXT NOT NULL,
    "calculatedAmount" DECIMAL(15,2) NOT NULL,
    "referenceData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "CaseCostCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseCostCalculation_tenantId_caseId_type_status_idx" ON "CaseCostCalculation"("tenantId", "caseId", "type", "status");

-- CreateIndex
CREATE INDEX "CaseCostCalculation_caseId_fingerprint_idx" ON "CaseCostCalculation"("caseId", "fingerprint");

-- CreateIndex
CREATE INDEX "CaseLedgerEntry_costCalculationId_idx" ON "CaseLedgerEntry"("costCalculationId");

-- AddForeignKey
ALTER TABLE "CaseCostCalculation" ADD CONSTRAINT "CaseCostCalculation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCostCalculation" ADD CONSTRAINT "CaseCostCalculation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseLedgerEntry" ADD CONSTRAINT "CaseLedgerEntry_costCalculationId_fkey" FOREIGN KEY ("costCalculationId") REFERENCES "CaseCostCalculation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
