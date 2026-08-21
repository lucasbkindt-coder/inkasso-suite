-- CreateEnum
CREATE TYPE "InstallmentRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InstallmentRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "debtorPartyId" UUID NOT NULL,
    "status" "InstallmentRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "requestedMonthlyAmount" DECIMAL(15,2) NOT NULL,
    "preferredStartDate" DATE NOT NULL,
    "numberOfInstallments" INTEGER,
    "debtorMessage" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "reviewedByMembershipId" UUID,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallmentRequest_tenantId_status_submittedAt_idx" ON "InstallmentRequest"("tenantId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "InstallmentRequest_caseId_status_idx" ON "InstallmentRequest"("caseId", "status");

-- CreateIndex
CREATE INDEX "InstallmentRequest_debtorPartyId_submittedAt_idx" ON "InstallmentRequest"("debtorPartyId", "submittedAt");

-- AddForeignKey
ALTER TABLE "InstallmentRequest" ADD CONSTRAINT "InstallmentRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentRequest" ADD CONSTRAINT "InstallmentRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentRequest" ADD CONSTRAINT "InstallmentRequest_debtorPartyId_fkey" FOREIGN KEY ("debtorPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentRequest" ADD CONSTRAINT "InstallmentRequest_reviewedByMembershipId_fkey" FOREIGN KEY ("reviewedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
