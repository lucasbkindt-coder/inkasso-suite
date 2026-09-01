-- CreateEnum
CREATE TYPE "DeskTicketStatus" AS ENUM ('OPEN', 'PENDING', 'WAITING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeskTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_TICKET_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_TICKET_STATUS_CHANGED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_TICKET_PRIORITY_CHANGED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_TICKET_ASSIGNEE_CHANGED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_TICKET_PARTY_LINKED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_TICKET_CASE_LINKED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_TICKET_COMMENT_ADDED';

-- AlterEnum
ALTER TYPE "CommunicationChannel" ADD VALUE 'INTERNAL';

-- AlterEnum
ALTER TYPE "CommunicationDirection" ADD VALUE 'INTERNAL';

-- AlterTable
ALTER TABLE "ActivityEvent" ADD COLUMN     "deskTicketId" UUID;

-- AlterTable
ALTER TABLE "CommunicationEvent" ADD COLUMN     "deskTicketId" UUID,
ALTER COLUMN "partyId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DeskTicketNumberSequence" (
    "tenantId" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeskTicketNumberSequence_pkey" PRIMARY KEY ("tenantId","year")
);

-- CreateTable
CREATE TABLE "DeskTicket" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "sequenceYear" INTEGER NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "status" "DeskTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "DeskTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category" VARCHAR(100),
    "partyId" UUID,
    "caseId" UUID,
    "assigneeMembershipId" UUID,
    "teamId" UUID,
    "createdByMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "DeskTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeskTicket_tenantId_status_updatedAt_idx" ON "DeskTicket"("tenantId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "DeskTicket_tenantId_priority_updatedAt_idx" ON "DeskTicket"("tenantId", "priority", "updatedAt");

-- CreateIndex
CREATE INDEX "DeskTicket_tenantId_assigneeMembershipId_status_idx" ON "DeskTicket"("tenantId", "assigneeMembershipId", "status");

-- CreateIndex
CREATE INDEX "DeskTicket_tenantId_teamId_status_idx" ON "DeskTicket"("tenantId", "teamId", "status");

-- CreateIndex
CREATE INDEX "DeskTicket_partyId_updatedAt_idx" ON "DeskTicket"("partyId", "updatedAt");

-- CreateIndex
CREATE INDEX "DeskTicket_caseId_updatedAt_idx" ON "DeskTicket"("caseId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeskTicket_tenantId_number_key" ON "DeskTicket"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "DeskTicket_tenantId_sequenceYear_sequenceNumber_key" ON "DeskTicket"("tenantId", "sequenceYear", "sequenceNumber");

-- CreateIndex
CREATE INDEX "ActivityEvent_deskTicketId_createdAt_idx" ON "ActivityEvent"("deskTicketId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunicationEvent_tenantId_deskTicketId_occurredAt_idx" ON "CommunicationEvent"("tenantId", "deskTicketId", "occurredAt");

-- AddForeignKey
ALTER TABLE "DeskTicketNumberSequence" ADD CONSTRAINT "DeskTicketNumberSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_deskTicketId_fkey" FOREIGN KEY ("deskTicketId") REFERENCES "DeskTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationEvent" ADD CONSTRAINT "CommunicationEvent_deskTicketId_fkey" FOREIGN KEY ("deskTicketId") REFERENCES "DeskTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskTicket" ADD CONSTRAINT "DeskTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskTicket" ADD CONSTRAINT "DeskTicket_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskTicket" ADD CONSTRAINT "DeskTicket_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskTicket" ADD CONSTRAINT "DeskTicket_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskTicket" ADD CONSTRAINT "DeskTicket_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskTicket" ADD CONSTRAINT "DeskTicket_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
