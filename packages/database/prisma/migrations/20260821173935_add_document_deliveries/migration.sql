-- CreateEnum
CREATE TYPE "DocumentDeliveryChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "DocumentDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "DocumentDelivery" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "channel" "DocumentDeliveryChannel" NOT NULL,
    "status" "DocumentDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "recipient" TEXT,
    "subject" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "provider" TEXT,
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentDelivery_tenantId_caseId_status_idx" ON "DocumentDelivery"("tenantId", "caseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentDelivery_documentId_channel_key" ON "DocumentDelivery"("documentId", "channel");

-- AddForeignKey
ALTER TABLE "DocumentDelivery" ADD CONSTRAINT "DocumentDelivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDelivery" ADD CONSTRAINT "DocumentDelivery_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentDelivery" ADD CONSTRAINT "DocumentDelivery_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CaseDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
