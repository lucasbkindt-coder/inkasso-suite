export type CaseStatus = "OPEN" | "CLOSED" | "CANCELLED";
export type CasePhase =
  | "NEW"
  | "PRE_COLLECTION"
  | "OUT_OF_COURT"
  | "PAYMENT_PLAN"
  | "JUDICIAL_DUNNING"
  | "LITIGATION"
  | "ENFORCEMENT"
  | "MONITORING"
  | "COMPLETED";
export type CasePriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type ClaimStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "DISPUTED" | "CANCELLED";
export type PartyRoleType = "CLIENT" | "DEBTOR" | "CONTACT" | "OTHER";

export type PartyAddress = {
  id: string;
  type: string;
  street: string;
  houseNumber: string | null;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  country: string;
  isPrimary: boolean;
};

export type PartyContact = {
  id: string;
  type: string;
  value: string;
  label: string | null;
  isPrimary: boolean;
};

export type CaseParty = {
  id: string;
  displayName: string;
  type: "PERSON" | "COMPANY";
  person: {
    salutation: string | null;
    title: string | null;
    firstName: string;
    lastName: string;
  } | null;
  company: { companyName: string; legalForm: string | null } | null;
  roles: { id: string; role: PartyRoleType }[];
  addresses: PartyAddress[];
  contacts: PartyContact[];
};

export type CaseClaim = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  defaultDate: string | null;
  principalAmount: string;
  currency: string;
  description: string | null;
  status: ClaimStatus;
};

export type CaseOwner = {
  id: string;
  user: { id: string; displayName: string | null; email: string };
} | null;

export type Case = {
  id: string;
  caseNumber: string;
  sequenceYear: number;
  sequenceNumber: number;
  status: CaseStatus;
  phase: CasePhase;
  priority: CasePriority;
  openedAt: string;
  closedAt: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  claim: CaseClaim | null;
  clientParty: CaseParty;
  debtorParty: CaseParty;
  ownerMembership: CaseOwner;
};

export type CasesResponse = {
  items: Case[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CreateCaseInput = {
  clientPartyId: string;
  debtorPartyId: string;
  priority?: CasePriority;
  internalNotes?: string;
  claim: {
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    defaultDate?: string;
    principalAmount: string;
    currency?: string;
    description?: string;
  };
};

export type UpdateCaseInput = Partial<
  Pick<Case, "status" | "phase" | "priority" | "internalNotes">
> & {
  ownerMembershipId?: string;
  claim?: Partial<Omit<CreateCaseInput["claim"], "defaultDate">> & { defaultDate?: string };
};
