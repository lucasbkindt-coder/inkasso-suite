-- Existing documents remain internal until explicitly released.
CREATE TYPE "PortalVisibility" AS ENUM ('INTERNAL', 'CLIENT', 'DEBTOR', 'BOTH');
ALTER TABLE "CaseDocument" ADD COLUMN "portalVisibility" "PortalVisibility" NOT NULL DEFAULT 'INTERNAL';
