-- CreateEnum
CREATE TYPE "PortalAccountType" AS ENUM ('CLIENT', 'DEBTOR');

-- CreateEnum
CREATE TYPE "PortalAccountStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'LOCKED', 'DISABLED');

-- CreateTable
CREATE TABLE "PortalAccount" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "portalType" "PortalAccountType" NOT NULL,
    "status" "PortalAccountStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "loginIdentifier" TEXT NOT NULL,
    "passwordHash" TEXT,
    "activatedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalActivation" (
    "id" UUID NOT NULL,
    "portalAccountId" UUID NOT NULL,
    "secretHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalActivation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalSession" (
    "id" UUID NOT NULL,
    "portalAccountId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PortalSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccount_loginIdentifier_key" ON "PortalAccount"("loginIdentifier");

-- CreateIndex
CREATE INDEX "PortalAccount_tenantId_portalType_status_idx" ON "PortalAccount"("tenantId", "portalType", "status");

-- CreateIndex
CREATE INDEX "PortalAccount_partyId_portalType_idx" ON "PortalAccount"("partyId", "portalType");

-- CreateIndex
CREATE UNIQUE INDEX "PortalAccount_tenantId_partyId_portalType_key" ON "PortalAccount"("tenantId", "partyId", "portalType");

-- CreateIndex
CREATE INDEX "PortalActivation_portalAccountId_expiresAt_idx" ON "PortalActivation"("portalAccountId", "expiresAt");

-- CreateIndex
CREATE INDEX "PortalActivation_portalAccountId_usedAt_invalidatedAt_idx" ON "PortalActivation"("portalAccountId", "usedAt", "invalidatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PortalSession_tokenHash_key" ON "PortalSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PortalSession_portalAccountId_revokedAt_expiresAt_idx" ON "PortalSession"("portalAccountId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "PortalSession_expiresAt_idx" ON "PortalSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalAccount" ADD CONSTRAINT "PortalAccount_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalActivation" ADD CONSTRAINT "PortalActivation_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "PortalAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalSession" ADD CONSTRAINT "PortalSession_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "PortalAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
