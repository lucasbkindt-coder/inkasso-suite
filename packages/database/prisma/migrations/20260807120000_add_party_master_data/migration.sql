-- CreateEnum
CREATE TYPE "PartyType" AS ENUM ('PERSON', 'COMPANY');

-- CreateEnum
CREATE TYPE "PartyRoleType" AS ENUM ('CLIENT', 'DEBTOR', 'CONTACT', 'OTHER');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('PRIMARY', 'DELIVERY', 'BILLING', 'PREVIOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('EMAIL', 'PHONE', 'MOBILE', 'FAX', 'WEBSITE', 'OTHER');

-- CreateTable
CREATE TABLE "Party" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "PartyType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "salutation" TEXT,
    "title" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalForm" TEXT,
    "vatId" TEXT,
    "taxNumber" TEXT,
    "commercialRegister" TEXT,
    "registerNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyRole" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "role" "PartyRoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PartyRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "type" "AddressType" NOT NULL DEFAULT 'PRIMARY',
    "street" TEXT NOT NULL,
    "houseNumber" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'DE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL,
    "partyId" UUID NOT NULL,
    "type" "ContactType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Party_tenantId_deletedAt_displayName_idx" ON "Party"("tenantId", "deletedAt", "displayName");
CREATE INDEX "Party_tenantId_type_deletedAt_idx" ON "Party"("tenantId", "type", "deletedAt");
CREATE UNIQUE INDEX "Person_partyId_key" ON "Person"("partyId");
CREATE INDEX "Person_lastName_firstName_idx" ON "Person"("lastName", "firstName");
CREATE UNIQUE INDEX "Company_partyId_key" ON "Company"("partyId");
CREATE INDEX "Company_companyName_idx" ON "Company"("companyName");
CREATE INDEX "Company_vatId_idx" ON "Company"("vatId");
CREATE UNIQUE INDEX "PartyRole_partyId_role_key" ON "PartyRole"("partyId", "role");
CREATE INDEX "PartyRole_role_deletedAt_idx" ON "PartyRole"("role", "deletedAt");
CREATE INDEX "Address_partyId_deletedAt_isPrimary_idx" ON "Address"("partyId", "deletedAt", "isPrimary");
CREATE INDEX "Address_postalCode_city_idx" ON "Address"("postalCode", "city");
CREATE INDEX "Contact_partyId_deletedAt_isPrimary_idx" ON "Contact"("partyId", "deletedAt", "isPrimary");
CREATE INDEX "Contact_partyId_type_deletedAt_idx" ON "Contact"("partyId", "type", "deletedAt");
CREATE INDEX "Contact_value_idx" ON "Contact"("value");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Person" ADD CONSTRAINT "Person_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PartyRole" ADD CONSTRAINT "PartyRole_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Address" ADD CONSTRAINT "Address_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
