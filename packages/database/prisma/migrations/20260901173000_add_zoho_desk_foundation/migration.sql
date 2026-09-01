CREATE TYPE "IntegrationProvider" AS ENUM ('ZOHO_DESK');

CREATE TYPE "ExternalIntegrationEntityType" AS ENUM (
  'PARTY_CONTACT',
  'CASE_TICKET',
  'COMMUNICATION_MESSAGE',
  'COMMUNICATION_ATTACHMENT'
);

CREATE TABLE "ExternalIntegrationLink" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "entityType" "ExternalIntegrationEntityType" NOT NULL,
  "externalId" VARCHAR(150) NOT NULL,
  "partyId" UUID,
  "caseId" UUID,
  "communicationId" UUID,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalIntegrationLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalIntegrationLink_entity_target_check" CHECK (
    ("entityType" = 'PARTY_CONTACT' AND "partyId" IS NOT NULL AND "caseId" IS NULL AND "communicationId" IS NULL)
    OR ("entityType" = 'CASE_TICKET' AND "partyId" IS NULL AND "caseId" IS NOT NULL AND "communicationId" IS NULL)
    OR ("entityType" IN ('COMMUNICATION_MESSAGE', 'COMMUNICATION_ATTACHMENT') AND "partyId" IS NULL AND "caseId" IS NULL AND "communicationId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "ExternalIntegrationLink_tenantId_provider_entityType_externalId_key"
  ON "ExternalIntegrationLink"("tenantId", "provider", "entityType", "externalId");
CREATE UNIQUE INDEX "ExternalIntegrationLink_tenantId_provider_entityType_partyId_key"
  ON "ExternalIntegrationLink"("tenantId", "provider", "entityType", "partyId");
CREATE INDEX "ExternalIntegrationLink_tenantId_provider_entityType_idx"
  ON "ExternalIntegrationLink"("tenantId", "provider", "entityType");
CREATE INDEX "ExternalIntegrationLink_partyId_idx" ON "ExternalIntegrationLink"("partyId");
CREATE INDEX "ExternalIntegrationLink_caseId_idx" ON "ExternalIntegrationLink"("caseId");
CREATE INDEX "ExternalIntegrationLink_communicationId_idx" ON "ExternalIntegrationLink"("communicationId");

ALTER TABLE "ExternalIntegrationLink"
  ADD CONSTRAINT "ExternalIntegrationLink_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalIntegrationLink"
  ADD CONSTRAINT "ExternalIntegrationLink_partyId_fkey"
  FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalIntegrationLink"
  ADD CONSTRAINT "ExternalIntegrationLink_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExternalIntegrationLink"
  ADD CONSTRAINT "ExternalIntegrationLink_communicationId_fkey"
  FOREIGN KEY ("communicationId") REFERENCES "CommunicationEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
