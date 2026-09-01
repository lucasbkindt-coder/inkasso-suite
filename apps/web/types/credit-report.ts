export type CreditReportStatus = "DRAFT" | "ELIGIBILITY_REVIEW" | "ELIGIBLE" | "NOT_ELIGIBLE" | "APPROVED" | "READY_FOR_SUBMISSION" | "SUBMITTED" | "ACCEPTED" | "REJECTED" | "UPDATED" | "SETTLED" | "REVOKED" | "CANCELLED" | "ERROR";
export type CreditReportEligibility = "PENDING" | "ELIGIBLE" | "NOT_ELIGIBLE" | "REVIEW_REQUIRED";
export type CreditReportProvider = "MANUAL" | "MOCK" | "SCHUFA" | "EXPERIAN" | "CREDITREFORM" | "OTHER";
export type CreditReportCheck = { key: string; label: string; level: "GREEN" | "YELLOW" | "RED"; explanation: string };
export type CreditReport = {
  id: string; partyId: string; caseId: string; provider: CreditReportProvider; status: CreditReportStatus;
  eligibilityStatus: CreditReportEligibility; eligibilityReason: string | null; eligibilityDetails: CreditReportCheck[] | null;
  eligibilityCheckedAt: string | null; approvedAt: string | null; approvalReason: string | null; approvalStaleAt: string | null;
  reportedAmount: string | null; currency: string; settledAt: string | null; cancelledAt: string | null; createdAt: string; updatedAt: string;
  externalSubmissionConfigured: false;
  party: { id: string; displayName: string; processingRestrictedAt: string | null; addresses: { street: string; houseNumber: string | null; postalCode: string; city: string; country: string; isPrimary: boolean }[] };
  case: { id: string; caseNumber: string; status: string; clientParty: { displayName: string }; claim: { invoiceNumber: string; status: string; disputeStatus: string; description: string | null } | null };
  createdByMembership: { user: { displayName: string | null; email: string } };
  approvedByMembership: { user: { displayName: string | null; email: string } } | null;
  events: { id: string; eventType: string; statusBefore: CreditReportStatus | null; statusAfter: CreditReportStatus | null; reason: string | null; createdAt: string; actorMembership: { user: { displayName: string | null; email: string } } | null }[];
};
export type CreditReportOptions = { cases: { id: string; caseNumber: string; debtorParty: { id: string; displayName: string }; clientParty: { displayName: string } }[]; providers: CreditReportProvider[]; externalSubmissionConfigured: false };
