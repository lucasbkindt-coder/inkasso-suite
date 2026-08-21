-- CreateEnum
CREATE TYPE "ClientSubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ClientSubmission" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "clientPartyId" UUID NOT NULL,
    "status" "ClientSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reference" TEXT,
    "debtorType" "PartyType" NOT NULL,
    "debtorFirstName" TEXT,
    "debtorLastName" TEXT,
    "debtorCompanyName" TEXT,
    "debtorStreet" TEXT NOT NULL,
    "debtorHouseNumber" TEXT,
    "debtorPostalCode" TEXT NOT NULL,
    "debtorCity" TEXT NOT NULL,
    "debtorCountry" CHAR(2) NOT NULL DEFAULT 'DE',
    "debtorEmail" TEXT,
    "debtorPhone" TEXT,
    "invoiceNumber" TEXT,
    "invoiceDate" DATE,
    "dueDate" DATE NOT NULL,
    "principalAmount" DECIMAL(15,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'EUR',
    "claimDescription" TEXT,
    "clientNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "acceptedCaseId" UUID,
    "reviewedByMembershipId" UUID,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientSubmission_acceptedCaseId_key" ON "ClientSubmission"("acceptedCaseId");

-- CreateIndex
CREATE INDEX "ClientSubmission_tenantId_status_idx" ON "ClientSubmission"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ClientSubmission_tenantId_clientPartyId_idx" ON "ClientSubmission"("tenantId", "clientPartyId");

-- CreateIndex
CREATE INDEX "ClientSubmission_submittedAt_idx" ON "ClientSubmission"("submittedAt");

-- CreateIndex
CREATE INDEX "ClientSubmission_acceptedCaseId_idx" ON "ClientSubmission"("acceptedCaseId");

-- AddForeignKey
ALTER TABLE "ClientSubmission" ADD CONSTRAINT "ClientSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSubmission" ADD CONSTRAINT "ClientSubmission_clientPartyId_fkey" FOREIGN KEY ("clientPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSubmission" ADD CONSTRAINT "ClientSubmission_acceptedCaseId_fkey" FOREIGN KEY ("acceptedCaseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSubmission" ADD CONSTRAINT "ClientSubmission_reviewedByMembershipId_fkey" FOREIGN KEY ("reviewedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
