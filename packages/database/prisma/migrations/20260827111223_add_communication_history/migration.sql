-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('PHONE', 'EMAIL', 'LETTER', 'PORTAL', 'IN_PERSON', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunicationSource" AS ENUM ('MANUAL', 'PORTAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "CommunicationAttachmentType" AS ENUM ('ORIGINAL_MESSAGE', 'ATTACHMENT', 'LETTER', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'COMMUNICATION_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'COMMUNICATION_UPDATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'COMMUNICATION_ATTACHMENT_ADDED';

-- CreateTable
CREATE TABLE "CommunicationEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "caseId" UUID,
    "direction" "CommunicationDirection" NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "source" "CommunicationSource" NOT NULL DEFAULT 'MANUAL',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "subject" TEXT,
    "summary" TEXT NOT NULL,
    "externalReference" TEXT,
    "durationSeconds" INTEGER,
    "createdByMembershipId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationAttachment" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "communicationId" UUID NOT NULL,
    "attachmentType" "CommunicationAttachmentType" NOT NULL DEFAULT 'ATTACHMENT',
    "originalFileName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(150) NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" CHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunicationEvent_tenantId_partyId_occurredAt_idx" ON "CommunicationEvent"("tenantId", "partyId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationEvent_tenantId_caseId_occurredAt_idx" ON "CommunicationEvent"("tenantId", "caseId", "occurredAt");

-- CreateIndex
CREATE INDEX "CommunicationEvent_createdByMembershipId_idx" ON "CommunicationEvent"("createdByMembershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationAttachment_storageKey_key" ON "CommunicationAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "CommunicationAttachment_tenantId_communicationId_idx" ON "CommunicationAttachment"("tenantId", "communicationId");

-- AddForeignKey
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationAttachment" ADD CONSTRAINT "CommunicationAttachment_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES "CommunicationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
