-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "assignedMembershipId" UUID;

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "cancelledByMembershipId" UUID,
ADD COLUMN     "createdByMembershipId" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordMustChange" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "tenantMembershipId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSession_tenantMembershipId_revokedAt_expiresAt_idx" ON "StaffSession"("tenantMembershipId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "StaffSession_userId_tenantId_revokedAt_idx" ON "StaffSession"("userId", "tenantId", "revokedAt");

-- CreateIndex
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- CreateIndex
CREATE INDEX "Case_tenantId_assignedMembershipId_deletedAt_idx" ON "Case"("tenantId", "assignedMembershipId", "deletedAt");

-- CreateIndex
CREATE INDEX "InstallmentPlan_createdByMembershipId_idx" ON "InstallmentPlan"("createdByMembershipId");

-- CreateIndex
CREATE INDEX "InstallmentPlan_cancelledByMembershipId_idx" ON "InstallmentPlan"("cancelledByMembershipId");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_assignedMembershipId_fkey" FOREIGN KEY ("assignedMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_cancelledByMembershipId_fkey" FOREIGN KEY ("cancelledByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_tenantMembershipId_fkey" FOREIGN KEY ("tenantMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
