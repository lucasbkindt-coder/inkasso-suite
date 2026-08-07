-- CreateTable
CREATE TABLE "TenantDocumentSettings" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "legalName" TEXT,
    "street" TEXT NOT NULL,
    "houseNumber" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'DE',
    "phone" TEXT,
    "mobile" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "website" TEXT,
    "registrationCourt" TEXT,
    "registrationNumber" TEXT,
    "vatId" TEXT,
    "managingDirector" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "bankName" TEXT,
    "creditorId" TEXT,
    "documentFooter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantDocumentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantDocumentSettings_tenantId_key" ON "TenantDocumentSettings"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantDocumentSettings" ADD CONSTRAINT "TenantDocumentSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
