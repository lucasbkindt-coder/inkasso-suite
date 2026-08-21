-- AlterTable
ALTER TABLE "ClientSubmission" ADD COLUMN     "strongMatchCandidateIds" JSONB,
ADD COLUMN     "strongMatchOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "strongMatchOverrideAt" TIMESTAMP(3),
ADD COLUMN     "strongMatchOverrideReason" TEXT;
