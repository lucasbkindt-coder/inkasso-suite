-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('ACCESS', 'ERASURE', 'RECTIFICATION', 'RESTRICTION');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('RECEIVED', 'IDENTITY_CHECK', 'IN_REVIEW', 'WAITING_INFORMATION', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DataSubjectDataAction" AS ENUM ('DELETE', 'RESTRICT', 'ANONYMIZE', 'RETAIN', 'REVIEW');

-- CreateEnum
CREATE TYPE "DataSubjectDataCategory" AS ENUM ('MASTER_DATA', 'ADDRESSES', 'CONTACT_DATA', 'CASES', 'CLAIMS', 'LEDGER', 'PAYMENTS', 'TASKS', 'DOCUMENTS', 'COMMUNICATIONS', 'PORTAL', 'INSTALLMENTS', 'ENFORCEMENT', 'ACTIVITY', 'CLIENT_CONTACT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_REQUEST_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_REQUEST_ASSIGNED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_IDENTITY_VERIFIED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_REQUEST_STATUS_CHANGED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_ACCESS_EXPORT_GENERATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_REVIEW_DECIDED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_RESTRICTION_APPLIED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_RESTRICTION_REMOVED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DATA_SUBJECT_REQUEST_COMPLETED';

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "processingRestrictedAt" TIMESTAMP(3),
ADD COLUMN     "processingRestrictionReason" TEXT;

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "subjectPartyId" UUID,
    "clientContactId" UUID,
    "requestType" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "identityVerifiedAt" TIMESTAMP(3),
    "identityVerifiedByMembershipId" UUID,
    "identityVerificationNote" TEXT,
    "dueAt" TIMESTAMP(3),
    "assignedMembershipId" UUID,
    "description" TEXT,
    "notes" TEXT,
    "decision" TEXT,
    "decisionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectAccessExport" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'JSON',
    "snapshot" JSONB NOT NULL,
    "sha256" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataSubjectAccessExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectDataReview" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "category" "DataSubjectDataCategory" NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "proposedAction" "DataSubjectDataAction" NOT NULL DEFAULT 'REVIEW',
    "finalAction" "DataSubjectDataAction",
    "reason" TEXT,
    "reviewedByMembershipId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectDataReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataSubjectRequest_tenantId_status_dueAt_idx" ON "DataSubjectRequest"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_tenantId_subjectPartyId_idx" ON "DataSubjectRequest"("tenantId", "subjectPartyId");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_tenantId_clientContactId_idx" ON "DataSubjectRequest"("tenantId", "clientContactId");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_assignedMembershipId_idx" ON "DataSubjectRequest"("assignedMembershipId");

-- CreateIndex
CREATE INDEX "DataSubjectAccessExport_tenantId_requestId_generatedAt_idx" ON "DataSubjectAccessExport"("tenantId", "requestId", "generatedAt");

-- CreateIndex
CREATE INDEX "DataSubjectDataReview_tenantId_requestId_idx" ON "DataSubjectDataReview"("tenantId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSubjectDataReview_requestId_category_key" ON "DataSubjectDataReview"("requestId", "category");

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_subjectPartyId_fkey" FOREIGN KEY ("subjectPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_identityVerifiedByMembershipId_fkey" FOREIGN KEY ("identityVerifiedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_assignedMembershipId_fkey" FOREIGN KEY ("assignedMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectAccessExport" ADD CONSTRAINT "DataSubjectAccessExport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectAccessExport" ADD CONSTRAINT "DataSubjectAccessExport_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataSubjectRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectAccessExport" ADD CONSTRAINT "DataSubjectAccessExport_generatedByMembershipId_fkey" FOREIGN KEY ("generatedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectDataReview" ADD CONSTRAINT "DataSubjectDataReview_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectDataReview" ADD CONSTRAINT "DataSubjectDataReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DataSubjectRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectDataReview" ADD CONSTRAINT "DataSubjectDataReview_reviewedByMembershipId_fkey" FOREIGN KEY ("reviewedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

