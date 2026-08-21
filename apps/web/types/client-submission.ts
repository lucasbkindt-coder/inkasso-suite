export type ClientSubmissionStatus = "SUBMITTED" | "UNDER_REVIEW" | "ACCEPTED" | "REJECTED";

export type ClientSubmissionListItem = {
  id: string;
  reference: string | null;
  debtorDisplayName: string | null;
  principalAmount: string;
  currency: string;
  submittedAt: string;
  status: ClientSubmissionStatus;
  acceptedCaseId: string | null;
  acceptedCaseNumber: string | null;
};

export type ClientSubmissionDetail = {
  id: string;
  status: ClientSubmissionStatus;
  reference: string | null;
  debtorType: "PERSON" | "COMPANY";
  debtorFirstName: string | null;
  debtorLastName: string | null;
  debtorCompanyName: string | null;
  debtorStreet: string;
  debtorHouseNumber: string | null;
  debtorPostalCode: string;
  debtorCity: string;
  debtorCountry: string;
  debtorEmail: string | null;
  debtorPhone: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string;
  principalAmount: string;
  currency: string;
  claimDescription: string | null;
  clientNote: string | null;
  submittedAt: string;
  acceptedCaseId: string | null;
  acceptedCaseNumber: string | null;
};

export type CreateClientSubmissionInput = {
  reference?: string;
  debtorType: "PERSON" | "COMPANY";
  debtorFirstName?: string;
  debtorLastName?: string;
  debtorCompanyName?: string;
  debtorStreet: string;
  debtorHouseNumber?: string;
  debtorPostalCode: string;
  debtorCity: string;
  debtorCountry?: string;
  debtorEmail?: string;
  debtorPhone?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate: string;
  principalAmount: string;
  currency?: string;
  claimDescription?: string;
  clientNote?: string;
};

export type CreateClientSubmissionResponse = {
  id: string;
  status: ClientSubmissionStatus;
  reference: string | null;
  submittedAt: string;
};

export type InternalClientSubmission = ClientSubmissionDetail & {
  tenantId: string;
  clientPartyId: string;
  reviewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  reviewedByMembershipId: string | null;
  rejectionReason: string | null;
  clientParty: { displayName: string };
  acceptedCase: { id: string; caseNumber: string } | null;
  reviewedByMembership: {
    user: { displayName: string | null; email: string };
  } | null;
};

export type ClientSubmissionsResponse = {
  items: InternalClientSubmission[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type DebtorCandidate = {
  id: string;
  displayName: string;
  type: "PERSON" | "COMPANY";
  address: {
    street: string;
    houseNumber: string | null;
    postalCode: string;
    city: string;
    country: string;
  } | null;
  email: string | null;
  phone: string | null;
  matches: string[];
  matchStrength: "POSSIBLE" | "STRONG";
  caseCount: number;
  clientRelationships: string[];
};

export type AcceptClientSubmissionInput =
  | {
      debtorResolution: "NEW";
      strongMatchOverrideConfirmed?: boolean;
      strongMatchOverrideReason?: string;
    }
  | { debtorResolution: "EXISTING"; debtorPartyId: string };

export type AcceptClientSubmissionResponse = {
  id: string;
  status: "ACCEPTED";
  acceptedCaseId: string;
  acceptedCaseNumber: string;
};

export const clientSubmissionStatusLabels: Record<ClientSubmissionStatus, string> = {
  SUBMITTED: "Eingegangen",
  UNDER_REVIEW: "In Prüfung",
  ACCEPTED: "Angenommen",
  REJECTED: "Abgelehnt",
};
