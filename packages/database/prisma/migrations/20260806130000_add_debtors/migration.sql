-- CreateEnum
CREATE TYPE "DebtorType" AS ENUM ('PERSON', 'COMPANY');

-- CreateTable
CREATE TABLE "Debtor" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "DebtorType" NOT NULL DEFAULT 'PERSON',
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "street" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" CHAR(2) NOT NULL DEFAULT 'DE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Debtor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Debtor_tenantId_deletedAt_createdAt_idx" ON "Debtor"("tenantId", "deletedAt", "createdAt");
CREATE INDEX "Debtor_tenantId_type_deletedAt_idx" ON "Debtor"("tenantId", "type", "deletedAt");
CREATE INDEX "Debtor_tenantId_email_idx" ON "Debtor"("tenantId", "email");
CREATE INDEX "Debtor_lastName_firstName_idx" ON "Debtor"("lastName", "firstName");
CREATE INDEX "Debtor_companyName_idx" ON "Debtor"("companyName");

-- AddForeignKey
ALTER TABLE "Debtor" ADD CONSTRAINT "Debtor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
