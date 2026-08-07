CREATE TYPE "TaskType" AS ENUM ('TASK', 'DEADLINE', 'FOLLOW_UP');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

CREATE TABLE "CaseTask" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "caseId" UUID,
  "type" "TaskType" NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "followUpAt" TIMESTAMP(3),
  "assignedMembershipId" UUID,
  "createdByMembershipId" UUID,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseTask_tenantId_status_dueAt_idx" ON "CaseTask"("tenantId", "status", "dueAt");
CREATE INDEX "CaseTask_tenantId_assignedMembershipId_status_idx" ON "CaseTask"("tenantId", "assignedMembershipId", "status");
CREATE INDEX "CaseTask_tenantId_caseId_status_idx" ON "CaseTask"("tenantId", "caseId", "status");
CREATE INDEX "CaseTask_tenantId_followUpAt_idx" ON "CaseTask"("tenantId", "followUpAt");
ALTER TABLE "CaseTask" ADD CONSTRAINT "CaseTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseTask" ADD CONSTRAINT "CaseTask_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseTask" ADD CONSTRAINT "CaseTask_assignedMembershipId_fkey" FOREIGN KEY ("assignedMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CaseTask" ADD CONSTRAINT "CaseTask_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "TenantMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
