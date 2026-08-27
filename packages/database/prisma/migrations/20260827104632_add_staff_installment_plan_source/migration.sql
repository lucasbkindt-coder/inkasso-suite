-- CreateEnum
CREATE TYPE "InstallmentPlanSource" AS ENUM ('PORTAL_REQUEST', 'STAFF');

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "source" "InstallmentPlanSource" NOT NULL DEFAULT 'PORTAL_REQUEST',
ALTER COLUMN "sourceRequestId" DROP NOT NULL;
