-- CreateEnum
CREATE TYPE "TelephonyProviderType" AS ENUM ('DIRECT_WEBRTC', 'GATEWAY_REQUIRED', 'MOCK');

-- CreateEnum
CREATE TYPE "TelephonyProviderStatus" AS ENUM ('NOT_CONFIGURED', 'ACTIVE', 'DISABLED', 'ERROR');

-- CreateEnum
CREATE TYPE "TelephonyRegistrationStatus" AS ENUM ('NOT_CONFIGURED', 'DISCONNECTED', 'REGISTERING', 'REGISTERED', 'ERROR');

-- CreateEnum
CREATE TYPE "TelephonyTransport" AS ENUM ('UDP', 'TCP', 'TLS', 'WSS');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('CREATED', 'RINGING', 'ANSWERED', 'HELD', 'ENDED', 'MISSED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CallDisposition" AS ENUM ('REACHED', 'NOT_REACHED', 'BUSY', 'NO_ANSWER', 'CALLBACK_REQUESTED', 'PAYMENT_PROMISE', 'INSTALLMENT_REQUEST', 'DISPUTE', 'WRONG_NUMBER', 'OTHER');

-- CreateEnum
CREATE TYPE "CallerMatchStatus" AS ENUM ('MATCHED', 'REVIEW_REQUIRED', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "AgentPresenceStatus" AS ENUM ('OFFLINE', 'AVAILABLE', 'BUSY', 'WRAP_UP', 'DO_NOT_DISTURB');

-- CreateEnum
CREATE TYPE "PhoneContactPreferenceValue" AS ENUM ('PHONE_ALLOWED', 'PHONE_BLOCKED', 'UNKNOWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CONFIG_CHANGED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_ACCOUNT_CHANGED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_STARTED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_RINGING';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_ANSWERED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_HELD';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_RESUMED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_ENDED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_FAILED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_MATCHED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_REASSIGNED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALL_DISPOSITION_SET';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_CALLBACK_TASK_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'TELEPHONY_PRESENCE_CHANGED';

-- CreateTable
CREATE TABLE "TelephonyProviderConfig" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "providerType" "TelephonyProviderType" NOT NULL,
    "status" "TelephonyProviderStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "defaultRegistrar" VARCHAR(500),
    "defaultProxy" VARCHAR(500),
    "defaultDomain" VARCHAR(255),
    "defaultPort" INTEGER,
    "defaultTransport" "TelephonyTransport",
    "defaultWebSocketUrl" VARCHAR(1000),
    "defaultStun" VARCHAR(1000),
    "defaultTurn" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelephonyProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTelephonyAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "telephonyProviderConfigId" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "extension" VARCHAR(50),
    "authUsername" VARCHAR(255),
    "displayNumber" VARCHAR(100),
    "outboundCallerId" VARCHAR(100),
    "registrarOverride" VARCHAR(500),
    "proxyOverride" VARCHAR(500),
    "domainOverride" VARCHAR(255),
    "portOverride" INTEGER,
    "transportOverride" "TelephonyTransport",
    "webSocketUrlOverride" VARCHAR(1000),
    "maxConcurrentCalls" INTEGER,
    "registrationStatus" "TelephonyRegistrationStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastRegistrationAt" TIMESTAMP(3),
    "lastRegistrationError" VARCHAR(500),
    "registrationSessionId" VARCHAR(128),
    "registrationSessionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTelephonyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTelephonyCredential" (
    "id" UUID NOT NULL,
    "staffTelephonyAccountId" UUID NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTelephonyCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelephonyCall" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "providerConfigId" UUID NOT NULL,
    "staffTelephonyAccountId" UUID,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'CREATED',
    "matchStatus" "CallerMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "partyId" UUID,
    "caseId" UUID,
    "ticketId" UUID,
    "agentMembershipId" UUID,
    "communicationEventId" UUID,
    "remoteNumber" VARCHAR(100) NOT NULL,
    "normalizedRemoteNumber" VARCHAR(32) NOT NULL,
    "localNumber" VARCHAR(100),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ringingAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "providerCallId" VARCHAR(255),
    "disposition" "CallDisposition",
    "wrapUpNote" VARCHAR(2000),
    "matchCandidateCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelephonyCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPresence" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "status" "AgentPresenceStatus" NOT NULL DEFAULT 'OFFLINE',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPresence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneContactPreference" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partyId" UUID,
    "contactId" UUID,
    "clientContactId" UUID,
    "preference" "PhoneContactPreferenceValue" NOT NULL DEFAULT 'UNKNOWN',
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneContactPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelephonyProviderConfig_tenantId_status_providerType_idx" ON "TelephonyProviderConfig"("tenantId", "status", "providerType");

-- CreateIndex
CREATE UNIQUE INDEX "TelephonyProviderConfig_tenantId_name_key" ON "TelephonyProviderConfig"("tenantId", "name");

-- CreateIndex
CREATE INDEX "StaffTelephonyAccount_tenantId_membershipId_enabled_isDefau_idx" ON "StaffTelephonyAccount"("tenantId", "membershipId", "enabled", "isDefault");

-- CreateIndex
CREATE INDEX "StaffTelephonyAccount_telephonyProviderConfigId_idx" ON "StaffTelephonyAccount"("telephonyProviderConfigId");

-- CreateIndex
CREATE INDEX "StaffTelephonyAccount_registrationSessionExpiresAt_idx" ON "StaffTelephonyAccount"("registrationSessionExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTelephonyAccount_tenantId_membershipId_name_key" ON "StaffTelephonyAccount"("tenantId", "membershipId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StaffTelephonyCredential_staffTelephonyAccountId_key" ON "StaffTelephonyCredential"("staffTelephonyAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TelephonyCall_communicationEventId_key" ON "TelephonyCall"("communicationEventId");

-- CreateIndex
CREATE INDEX "TelephonyCall_tenantId_startedAt_idx" ON "TelephonyCall"("tenantId", "startedAt");

-- CreateIndex
CREATE INDEX "TelephonyCall_tenantId_status_startedAt_idx" ON "TelephonyCall"("tenantId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "TelephonyCall_tenantId_matchStatus_startedAt_idx" ON "TelephonyCall"("tenantId", "matchStatus", "startedAt");

-- CreateIndex
CREATE INDEX "TelephonyCall_tenantId_normalizedRemoteNumber_idx" ON "TelephonyCall"("tenantId", "normalizedRemoteNumber");

-- CreateIndex
CREATE INDEX "TelephonyCall_partyId_startedAt_idx" ON "TelephonyCall"("partyId", "startedAt");

-- CreateIndex
CREATE INDEX "TelephonyCall_caseId_startedAt_idx" ON "TelephonyCall"("caseId", "startedAt");

-- CreateIndex
CREATE INDEX "TelephonyCall_ticketId_startedAt_idx" ON "TelephonyCall"("ticketId", "startedAt");

-- CreateIndex
CREATE INDEX "TelephonyCall_agentMembershipId_startedAt_idx" ON "TelephonyCall"("agentMembershipId", "startedAt");

-- CreateIndex
CREATE INDEX "TelephonyCall_staffTelephonyAccountId_startedAt_idx" ON "TelephonyCall"("staffTelephonyAccountId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelephonyCall_tenantId_providerConfigId_providerCallId_key" ON "TelephonyCall"("tenantId", "providerConfigId", "providerCallId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPresence_membershipId_key" ON "AgentPresence"("membershipId");

-- CreateIndex
CREATE INDEX "AgentPresence_tenantId_status_idx" ON "AgentPresence"("tenantId", "status");

-- CreateIndex
CREATE INDEX "PhoneContactPreference_tenantId_partyId_idx" ON "PhoneContactPreference"("tenantId", "partyId");

-- CreateIndex
CREATE INDEX "PhoneContactPreference_tenantId_contactId_idx" ON "PhoneContactPreference"("tenantId", "contactId");

-- CreateIndex
CREATE INDEX "PhoneContactPreference_tenantId_clientContactId_idx" ON "PhoneContactPreference"("tenantId", "clientContactId");

-- AddForeignKey
ALTER TABLE "TelephonyProviderConfig" ADD CONSTRAINT "TelephonyProviderConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTelephonyAccount" ADD CONSTRAINT "StaffTelephonyAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTelephonyAccount" ADD CONSTRAINT "StaffTelephonyAccount_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTelephonyAccount" ADD CONSTRAINT "StaffTelephonyAccount_telephonyProviderConfigId_fkey" FOREIGN KEY ("telephonyProviderConfigId") REFERENCES "TelephonyProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTelephonyCredential" ADD CONSTRAINT "StaffTelephonyCredential_staffTelephonyAccountId_fkey" FOREIGN KEY ("staffTelephonyAccountId") REFERENCES "StaffTelephonyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_providerConfigId_fkey" FOREIGN KEY ("providerConfigId") REFERENCES "TelephonyProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_staffTelephonyAccountId_fkey" FOREIGN KEY ("staffTelephonyAccountId") REFERENCES "StaffTelephonyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "DeskTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_agentMembershipId_fkey" FOREIGN KEY ("agentMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelephonyCall" ADD CONSTRAINT "TelephonyCall_communicationEventId_fkey" FOREIGN KEY ("communicationEventId") REFERENCES "CommunicationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPresence" ADD CONSTRAINT "AgentPresence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPresence" ADD CONSTRAINT "AgentPresence_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneContactPreference" ADD CONSTRAINT "PhoneContactPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneContactPreference" ADD CONSTRAINT "PhoneContactPreference_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneContactPreference" ADD CONSTRAINT "PhoneContactPreference_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneContactPreference" ADD CONSTRAINT "PhoneContactPreference_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
