-- CreateEnum
CREATE TYPE "DeskTicketSource" AS ENUM ('MANUAL', 'EMAIL');

-- CreateEnum
CREATE TYPE "MailAccountProvider" AS ENUM ('GENERIC_SMTP_IMAP', 'MOCK');

-- CreateEnum
CREATE TYPE "MailAccountStatus" AS ENUM ('NOT_CONFIGURED', 'ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "MailMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED');

-- CreateEnum
CREATE TYPE "MailReviewStatus" AS ENUM ('PENDING', 'RESOLVED', 'IGNORED');

-- CreateEnum
CREATE TYPE "MailReviewReason" AS ENUM ('PARTY_AMBIGUOUS', 'CASE_AMBIGUOUS', 'THREAD_AMBIGUOUS', 'MALFORMED_MAIL', 'BLOCKED_ATTACHMENT', 'PROCESSING_RESTRICTION', 'UNMATCHED_CONTEXT');

-- CreateEnum
CREATE TYPE "MailDraftStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OutboundMailJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'RETRY', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailContactPreference" AS ENUM ('EMAIL_ALLOWED', 'EMAIL_BLOCKED', 'UNKNOWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_INBOUND_IMPORTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_REVIEW_RESOLVED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_DRAFT_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_DRAFT_UPDATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_QUEUED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_SENT';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_FAILED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_ATTACHMENT_IMPORTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'DESK_MAIL_READ';

-- AlterTable
ALTER TABLE "CommunicationEvent" ALTER COLUMN "createdByMembershipId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "DeskTicket" ADD COLUMN     "mailAccountId" UUID,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "source" "DeskTicketSource" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "unreadAt" TIMESTAMP(3),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "MailAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "emailAddress" VARCHAR(320) NOT NULL,
    "displayName" VARCHAR(200),
    "provider" "MailAccountProvider" NOT NULL,
    "status" "MailAccountStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "inboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outboundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outboundRateLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailAccountCredential" (
    "id" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailAccountCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "communicationEventId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "direction" "MailMessageDirection" NOT NULL,
    "messageId" VARCHAR(998),
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "inReplyTo" VARCHAR(998),
    "references" TEXT[],
    "subject" VARCHAR(998) NOT NULL,
    "fromAddress" VARCHAR(320) NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "bccAddresses" TEXT[],
    "sanitizedHtml" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "providerExternalId" VARCHAR(300),
    "deliveryStatus" "MailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "rawMessageStored" BOOLEAN NOT NULL DEFAULT false,
    "autoSubmitted" VARCHAR(100),
    "precedence" VARCHAR(100),
    "autoResponseSuppress" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailReviewItem" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "mailAccountId" UUID,
    "mailMessageId" UUID,
    "deskTicketId" UUID,
    "reason" "MailReviewReason" NOT NULL,
    "status" "MailReviewStatus" NOT NULL DEFAULT 'PENDING',
    "summary" VARCHAR(500) NOT NULL,
    "suggestedPartyId" UUID,
    "suggestedCaseId" UUID,
    "resolvedByMembershipId" UUID,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailDraft" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "communicationEventId" UUID NOT NULL,
    "status" "MailDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "subject" VARCHAR(998) NOT NULL,
    "bodyPlain" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "inReplyTo" VARCHAR(998),
    "references" TEXT[],
    "createdByMembershipId" UUID NOT NULL,
    "updatedByMembershipId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMailJob" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "draftId" UUID NOT NULL,
    "mailAccountId" UUID NOT NULL,
    "mailMessageId" UUID,
    "status" "OutboundMailJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastErrorCode" VARCHAR(100),
    "lastErrorMessage" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundMailJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeskMailSettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "globalSignaturePlain" TEXT,
    "globalSignatureHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeskMailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeskMailUserSignature" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "bodyPlain" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeskMailUserSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeskCannedResponse" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "subject" VARCHAR(998),
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeskCannedResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailContactPreference" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partyId" UUID,
    "contactId" UUID,
    "clientContactId" UUID,
    "preference" "EmailContactPreference" NOT NULL DEFAULT 'UNKNOWN',
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailContactPreference_pkey" PRIMARY KEY ("id")
);

-- A contact preference always belongs to exactly one supported subject.
ALTER TABLE "MailContactPreference"
ADD CONSTRAINT "MailContactPreference_exactly_one_subject"
CHECK (num_nonnulls("partyId", "contactId", "clientContactId") = 1);

-- CreateIndex
CREATE INDEX "MailAccount_tenantId_status_isDefault_idx" ON "MailAccount"("tenantId", "status", "isDefault");

-- A tenant may have at most one default sender account.
CREATE UNIQUE INDEX "MailAccount_one_default_per_tenant"
ON "MailAccount"("tenantId")
WHERE "isDefault" = true;

-- CreateIndex
CREATE UNIQUE INDEX "MailAccount_tenantId_emailAddress_key" ON "MailAccount"("tenantId", "emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "MailAccountCredential_mailAccountId_key" ON "MailAccountCredential"("mailAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_communicationEventId_key" ON "MailMessage"("communicationEventId");

-- CreateIndex
CREATE INDEX "MailMessage_tenantId_messageId_idx" ON "MailMessage"("tenantId", "messageId");

-- CreateIndex
CREATE INDEX "MailMessage_tenantId_inReplyTo_idx" ON "MailMessage"("tenantId", "inReplyTo");

-- CreateIndex
CREATE INDEX "MailMessage_tenantId_direction_receivedAt_idx" ON "MailMessage"("tenantId", "direction", "receivedAt");

-- CreateIndex
CREATE INDEX "MailMessage_mailAccountId_deliveryStatus_createdAt_idx" ON "MailMessage"("mailAccountId", "deliveryStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_tenantId_idempotencyKey_key" ON "MailMessage"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MailReviewItem_tenantId_status_createdAt_idx" ON "MailReviewItem"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MailReviewItem_deskTicketId_status_idx" ON "MailReviewItem"("deskTicketId", "status");

-- CreateIndex
CREATE INDEX "MailReviewItem_mailMessageId_idx" ON "MailReviewItem"("mailMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "MailDraft_communicationEventId_key" ON "MailDraft"("communicationEventId");

-- CreateIndex
CREATE INDEX "MailDraft_tenantId_ticketId_status_idx" ON "MailDraft"("tenantId", "ticketId", "status");

-- CreateIndex
CREATE INDEX "MailDraft_mailAccountId_status_idx" ON "MailDraft"("mailAccountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundMailJob_draftId_key" ON "OutboundMailJob"("draftId");

-- CreateIndex
CREATE INDEX "OutboundMailJob_tenantId_status_nextAttemptAt_idx" ON "OutboundMailJob"("tenantId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OutboundMailJob_mailAccountId_status_nextAttemptAt_idx" ON "OutboundMailJob"("mailAccountId", "status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeskMailSettings_tenantId_key" ON "DeskMailSettings"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "DeskMailUserSignature_membershipId_key" ON "DeskMailUserSignature"("membershipId");

-- CreateIndex
CREATE INDEX "DeskMailUserSignature_tenantId_idx" ON "DeskMailUserSignature"("tenantId");

-- CreateIndex
CREATE INDEX "DeskCannedResponse_tenantId_isActive_idx" ON "DeskCannedResponse"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DeskCannedResponse_tenantId_name_key" ON "DeskCannedResponse"("tenantId", "name");

-- CreateIndex
CREATE INDEX "MailContactPreference_tenantId_partyId_idx" ON "MailContactPreference"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "MailContactPreference_tenantId_contactId_idx" ON "MailContactPreference"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "MailContactPreference_tenantId_clientContactId_idx" ON "MailContactPreference"("tenantId", "clientContactId");

-- CreateIndex
CREATE INDEX "DeskTicket_tenantId_source_unreadAt_idx" ON "DeskTicket"("tenantId", "source", "unreadAt");

-- CreateIndex
CREATE INDEX "DeskTicket_mailAccountId_updatedAt_idx" ON "DeskTicket"("mailAccountId", "updatedAt");

-- AddForeignKey
ALTER TABLE "DeskTicket" ADD CONSTRAINT "DeskTicket_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAccount" ADD CONSTRAINT "MailAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailAccountCredential" ADD CONSTRAINT "MailAccountCredential_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_communicationEventId_fkey" FOREIGN KEY ("communicationEventId") REFERENCES "CommunicationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailReviewItem" ADD CONSTRAINT "MailReviewItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailReviewItem" ADD CONSTRAINT "MailReviewItem_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailReviewItem" ADD CONSTRAINT "MailReviewItem_mailMessageId_fkey" FOREIGN KEY ("mailMessageId") REFERENCES "MailMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailReviewItem" ADD CONSTRAINT "MailReviewItem_deskTicketId_fkey" FOREIGN KEY ("deskTicketId") REFERENCES "DeskTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailReviewItem" ADD CONSTRAINT "MailReviewItem_suggestedPartyId_fkey" FOREIGN KEY ("suggestedPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailReviewItem" ADD CONSTRAINT "MailReviewItem_suggestedCaseId_fkey" FOREIGN KEY ("suggestedCaseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailReviewItem" ADD CONSTRAINT "MailReviewItem_resolvedByMembershipId_fkey" FOREIGN KEY ("resolvedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailDraft" ADD CONSTRAINT "MailDraft_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailDraft" ADD CONSTRAINT "MailDraft_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "DeskTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailDraft" ADD CONSTRAINT "MailDraft_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailDraft" ADD CONSTRAINT "MailDraft_communicationEventId_fkey" FOREIGN KEY ("communicationEventId") REFERENCES "CommunicationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailDraft" ADD CONSTRAINT "MailDraft_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailDraft" ADD CONSTRAINT "MailDraft_updatedByMembershipId_fkey" FOREIGN KEY ("updatedByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMailJob" ADD CONSTRAINT "OutboundMailJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMailJob" ADD CONSTRAINT "OutboundMailJob_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "MailDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMailJob" ADD CONSTRAINT "OutboundMailJob_mailAccountId_fkey" FOREIGN KEY ("mailAccountId") REFERENCES "MailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMailJob" ADD CONSTRAINT "OutboundMailJob_mailMessageId_fkey" FOREIGN KEY ("mailMessageId") REFERENCES "MailMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskMailSettings" ADD CONSTRAINT "DeskMailSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskMailUserSignature" ADD CONSTRAINT "DeskMailUserSignature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskMailUserSignature" ADD CONSTRAINT "DeskMailUserSignature_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeskCannedResponse" ADD CONSTRAINT "DeskCannedResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailContactPreference" ADD CONSTRAINT "MailContactPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailContactPreference" ADD CONSTRAINT "MailContactPreference_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailContactPreference" ADD CONSTRAINT "MailContactPreference_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailContactPreference" ADD CONSTRAINT "MailContactPreference_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
