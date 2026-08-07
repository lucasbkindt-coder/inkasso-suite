-- CreateEnum
CREATE TYPE "LegalReferenceSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SUCCEEDED_WITH_CONFLICTS');

-- CreateEnum
CREATE TYPE "RvgFeeScheduleStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'REJECTED');

-- CreateTable
CREATE TABLE "BaseInterestRatePeriod" (
    "id" UUID NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "rate" DECIMAL(7,4) NOT NULL,
    "source" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "sourcePublishedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseInterestRatePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalReferenceSyncRun" (
    "id" UUID NOT NULL,
    "sourceType" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "LegalReferenceSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "fetchedRecords" INTEGER NOT NULL DEFAULT 0,
    "insertedRecords" INTEGER NOT NULL DEFAULT 0,
    "conflictRecords" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "LegalReferenceSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RvgFeeScheduleVersion" (
    "id" UUID NOT NULL,
    "identifier" TEXT NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "legalReference" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "status" "RvgFeeScheduleStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "aboveMaximumIncrement" DECIMAL(15,2) NOT NULL,
    "aboveMaximumFeeIncrease" DECIMAL(15,2) NOT NULL,
    "smallClaimCollectionFee" DECIMAL(15,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RvgFeeScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RvgFeeThreshold" (
    "id" UUID NOT NULL,
    "scheduleVersionId" UUID NOT NULL,
    "valueUpTo" DECIMAL(15,2) NOT NULL,
    "baseFee" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "RvgFeeThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BaseInterestRatePeriod_validFrom_key" ON "BaseInterestRatePeriod"("validFrom");

-- CreateIndex
CREATE INDEX "BaseInterestRatePeriod_validFrom_validTo_idx" ON "BaseInterestRatePeriod"("validFrom", "validTo");

-- CreateIndex
CREATE INDEX "RvgFeeScheduleVersion_status_validFrom_idx" ON "RvgFeeScheduleVersion"("status", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RvgFeeScheduleVersion_identifier_validFrom_key" ON "RvgFeeScheduleVersion"("identifier", "validFrom");

-- CreateIndex
CREATE INDEX "RvgFeeThreshold_scheduleVersionId_valueUpTo_idx" ON "RvgFeeThreshold"("scheduleVersionId", "valueUpTo");

-- CreateIndex
CREATE UNIQUE INDEX "RvgFeeThreshold_scheduleVersionId_valueUpTo_key" ON "RvgFeeThreshold"("scheduleVersionId", "valueUpTo");

-- AddForeignKey
ALTER TABLE "RvgFeeThreshold" ADD CONSTRAINT "RvgFeeThreshold_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "RvgFeeScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
