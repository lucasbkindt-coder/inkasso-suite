-- CreateEnum
CREATE TYPE "InstallmentPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "InstallmentPlanItemStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "debtorPartyId" UUID NOT NULL,
    "sourceRequestId" UUID NOT NULL,
    "status" "InstallmentPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "initialOpenAmount" DECIMAL(15,2) NOT NULL,
    "plannedInstallmentAmount" DECIMAL(15,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "numberOfInstallments" INTEGER NOT NULL,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentPlanItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "plannedAmount" DECIMAL(15,2) NOT NULL,
    "status" "InstallmentPlanItemStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPlan_sourceRequestId_key" ON "InstallmentPlan"("sourceRequestId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_tenantId_caseId_status_idx" ON "InstallmentPlan"("tenantId", "caseId", "status");

-- CreateIndex
CREATE INDEX "InstallmentPlan_tenantId_debtorPartyId_status_idx" ON "InstallmentPlan"("tenantId", "debtorPartyId", "status");

-- CreateIndex
CREATE INDEX "InstallmentPlanItem_tenantId_planId_dueDate_idx" ON "InstallmentPlanItem"("tenantId", "planId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPlanItem_planId_sequenceNumber_key" ON "InstallmentPlanItem"("planId", "sequenceNumber");

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_debtorPartyId_fkey" FOREIGN KEY ("debtorPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "InstallmentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlanItem" ADD CONSTRAINT "InstallmentPlanItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlanItem" ADD CONSTRAINT "InstallmentPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "InstallmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
