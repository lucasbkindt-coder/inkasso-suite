-- CreateEnum
CREATE TYPE "ActivityActorType" AS ENUM ('STAFF', 'PORTAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('PARTY_CREATED', 'PARTY_UPDATED', 'PARTY_ADDRESS_UPDATED', 'PARTY_CONTACT_UPDATED', 'CASE_CREATED', 'CASE_STATUS_CHANGED', 'CASE_ASSIGNEE_CHANGED', 'CLAIM_CREATED', 'CLAIM_UPDATED', 'COST_CREATED', 'PAYMENT_CREATED', 'PAYMENT_REVERSED', 'DOCUMENT_CREATED', 'DOCUMENT_VOIDED', 'DOCUMENT_EMAIL_SENT', 'DOCUMENT_EMAIL_FAILED', 'DOCUMENT_EMAIL_SKIPPED', 'TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'INSTALLMENT_REQUEST_CREATED', 'INSTALLMENT_REQUEST_REVIEWED', 'INSTALLMENT_REQUEST_APPROVED', 'INSTALLMENT_REQUEST_REJECTED', 'INSTALLMENT_PLAN_CREATED', 'INSTALLMENT_PLAN_ACTIVATED', 'INSTALLMENT_PLAN_CANCELLED', 'INSTALLMENT_PLAN_DEFAULTED', 'INSTALLMENT_PLAN_COMPLETED', 'PORTAL_ACCOUNT_CREATED', 'PORTAL_ACTIVATION_ISSUED');

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "caseId" UUID,
    "partyId" UUID,
    "actorType" "ActivityActorType" NOT NULL,
    "actorMembershipId" UUID,
    "actorPortalAccountId" UUID,
    "eventType" "ActivityEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "sourceEntityType" TEXT,
    "sourceEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_tenantId_createdAt_idx" ON "ActivityEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_caseId_createdAt_idx" ON "ActivityEvent"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_partyId_createdAt_idx" ON "ActivityEvent"("partyId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorMembershipId_idx" ON "ActivityEvent"("actorMembershipId");

-- CreateIndex
CREATE INDEX "ActivityEvent_actorPortalAccountId_idx" ON "ActivityEvent"("actorPortalAccountId");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_actorPortalAccountId_fkey" FOREIGN KEY ("actorPortalAccountId") REFERENCES "PortalAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
