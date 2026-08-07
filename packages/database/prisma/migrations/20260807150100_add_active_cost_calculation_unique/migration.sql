-- An active calculation may only be applied once. Reversed calculations remain auditable
-- and therefore do not participate in this uniqueness constraint.
CREATE UNIQUE INDEX "CaseCostCalculation_caseId_fingerprint_active_key"
ON "CaseCostCalculation"("caseId", "fingerprint")
WHERE "status" = 'APPLIED';
