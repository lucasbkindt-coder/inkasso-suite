CREATE UNIQUE INDEX "StaffTelephonyAccount_one_default_per_membership"
ON "StaffTelephonyAccount" ("tenantId", "membershipId")
WHERE "isDefault" = true;

ALTER TABLE "PhoneContactPreference"
ADD CONSTRAINT "PhoneContactPreference_exactly_one_subject"
CHECK (num_nonnulls("partyId", "contactId", "clientContactId") = 1);

ALTER TABLE "StaffTelephonyAccount"
ADD CONSTRAINT "StaffTelephonyAccount_valid_port"
CHECK ("portOverride" IS NULL OR "portOverride" BETWEEN 1 AND 65535),
ADD CONSTRAINT "StaffTelephonyAccount_valid_concurrency"
CHECK ("maxConcurrentCalls" IS NULL OR "maxConcurrentCalls" > 0);

ALTER TABLE "TelephonyProviderConfig"
ADD CONSTRAINT "TelephonyProviderConfig_valid_port"
CHECK ("defaultPort" IS NULL OR "defaultPort" BETWEEN 1 AND 65535);
