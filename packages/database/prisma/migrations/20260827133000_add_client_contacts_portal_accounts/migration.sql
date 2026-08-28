ALTER TYPE "ActivityEventType" ADD VALUE 'PORTAL_ACCOUNT_ACTIVATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'PORTAL_ACCOUNT_SUSPENDED';
ALTER TYPE "ActivityEventType" ADD VALUE 'PORTAL_ACCOUNT_REACTIVATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CLIENT_CONTACT_CREATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CLIENT_CONTACT_UPDATED';
ALTER TYPE "ActivityEventType" ADD VALUE 'CLIENT_CONTACT_PRIMARY_CHANGED';

DROP INDEX "PortalAccount_tenantId_partyId_portalType_key";

ALTER TABLE "PortalAccount" ADD COLUMN "clientContactId" UUID;

CREATE TABLE "ClientContact" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "salutation" TEXT,
    "title" TEXT,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdByMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientContact_tenantId_partyId_isActive_isPrimary_idx" ON "ClientContact"("tenantId", "partyId", "isActive", "isPrimary");
CREATE INDEX "ClientContact_partyId_isActive_idx" ON "ClientContact"("partyId", "isActive");
CREATE INDEX "ClientContact_createdByMembershipId_idx" ON "ClientContact"("createdByMembershipId");
CREATE UNIQUE INDEX "PortalAccount_clientContactId_key" ON "PortalAccount"("clientContactId");
CREATE INDEX "PortalAccount_tenantId_partyId_portalType_idx" ON "PortalAccount"("tenantId", "partyId", "portalType");

ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_clientContactId_fkey" FOREIGN KEY ("clientContactId") REFERENCES "ClientContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
