export type AddressResearchStatus = "CREATED" | "IN_PROGRESS" | "RESULT_AVAILABLE" | "NO_RESULT" | "REVIEW_REQUIRED" | "APPLIED" | "CANCELLED" | "ERROR";
export type AddressResearchReason = "UNKNOWN_ADDRESS" | "RETURNED_MAIL" | "MOVED" | "ADDRESS_UNCONFIRMED" | "ENFORCEMENT_PREPARATION" | "OTHER";
export type AddressResearchConfidence = "HIGH" | "MEDIUM" | "LOW";
export type AddressResearchProvider = "MANUAL" | "MOCK";

export type ResearchAddress = { id?: string; street: string; houseNumber: string | null; addressLine2?: string | null; postalCode: string; city: string; country: string; isPrimary?: boolean };
export type AddressResearchResult = {
  id: string; street: string; houseNumber: string | null; postalCode: string; city: string; country: string;
  additionalAddressLine: string | null; source: string; sourceReference: string | null; sourceDate: string | null;
  confidence: AddressResearchConfidence; qualityReason: string | null; isSelected: boolean; appliedAt: string | null; createdAt: string;
};
export type AddressResearch = {
  id: string; partyId: string; caseId: string | null; status: AddressResearchStatus; reason: AddressResearchReason | null;
  provider: AddressResearchProvider; requestedAt: string; completedAt: string | null; resultCount: number; selectedResultId: string | null;
  costAmount: string | null; costCurrency: string | null; notes: string | null;
  originalStreet: string | null; originalHouseNumber: string | null; originalAddressLine2: string | null; originalPostalCode: string | null; originalCity: string | null; originalCountry: string | null;
  party: { id: string; displayName: string; processingRestrictedAt: string | null; addresses: ResearchAddress[] };
  case: { id: string; caseNumber: string } | null;
  requestedByMembership: { id: string; user: { displayName: string | null; email: string } };
  results: AddressResearchResult[];
};
export type AddressResearchOptions = {
  parties: { id: string; displayName: string }[];
  assignees: { id: string; displayName: string }[];
  cases: { id: string; caseNumber: string; debtorPartyId: string }[];
};
