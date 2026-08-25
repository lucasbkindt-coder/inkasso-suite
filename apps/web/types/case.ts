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

export type LedgerEntrySide = "DEBIT" | "CREDIT";
export type LedgerEntryType =
  | "PRINCIPAL"
  | "INTEREST"
  | "COLLECTION_FEE"
  | "EXPENSE"
  | "COURT_COST"
  | "ENFORCEMENT_COST"
  | "PAYMENT"
  | "CREDIT_NOTE"
  | "CORRECTION"
  | "OTHER";

export type LedgerEntry = {
  id: string;
  side: LedgerEntrySide;
  type: LedgerEntryType;
  status: "ACTIVE" | "REVERSED";
  amount: string;
  currency: string;
  bookingDate: string;
  valueDate: string | null;
  description: string;
  externalReference: string | null;
  source: string | null;
  reversedEntryId: string | null;
  allocatedAmount?: string;
  remainingAmount?: string | null;
  paymentAllocations?: PaymentAllocation[];
};

export type LedgerResponse = {
  items: LedgerEntry[];
  totals: {
    totalDebit: string;
    totalCredit: string;
    balance: string;
    openCosts: string;
    openInterest: string;
    openPrincipal: string;
    totalOpen: string;
    unallocatedPayments: string;
  };
};

export type PaymentAllocation = {
  id?: string;
  targetEntryId: string;
  amount: string;
  allocationOrder: number;
  policy?: "BGB_367_DEFAULT" | "CUSTOM";
  targetType?: LedgerEntryType;
  targetDescription?: string;
  targetEntry?: { description: string; type: LedgerEntryType };
};
export type CreatePaymentInput = {
  amount: string;
  bookingDate: string;
  valueDate?: string;
  currency?: string;
  reference?: string;
  description?: string;
  allocationPolicy?: "BGB_367_DEFAULT" | "CUSTOM";
  allocations?: { targetEntryId: string; amount: string }[];
};
export type PaymentApplyResponse = {
  payment: LedgerEntry;
  allocations: PaymentAllocation[];
  unallocatedAmount: string;
  balances: LedgerResponse["totals"];
};

export type CreateLedgerEntryInput = {
  type: Exclude<LedgerEntryType, "PRINCIPAL">;
  side?: LedgerEntrySide;
  amount: string;
  currency?: string;
  bookingDate: string;
  valueDate?: string;
  description: string;
};

export type DocumentTemplate = {
  id: string;
  tenantId: string | null;
  key: string;
  name: string;
  type: string;
  version: number;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  subject: string | null;
  bodyTemplate: string;
  createdAt: string;
  updatedAt: string;
};
export type DocumentType =
  | "PAYMENT_REQUEST"
  | "SECOND_PAYMENT_REQUEST"
  | "JUDICIAL_DUNNING_NOTICE"
  | "ENFORCEMENT_NOTICE"
  | "PAYMENT_PLAN"
  | "CUSTOM";
export type DocumentTemplateInput = {
  name: string;
  key: string;
  type: DocumentType;
  subject?: string;
  bodyTemplate: string;
};
export type DocumentPreview = {
  subject: string;
  renderedBody: string;
  templateVersion: number;
  warnings?: string[];
};
export type TenantDocumentSettings = {
  id: string;
  tenantId: string;
  companyName: string;
  legalName: string | null;
  street: string;
  houseNumber: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  email: string | null;
  website: string | null;
  registrationCourt: string | null;
  registrationNumber: string | null;
  vatId: string | null;
  managingDirector: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  creditorId: string | null;
  documentFooter: string | null;
  createdAt: string;
  updatedAt: string;
};
export type TenantDocumentSettingsInput = {
  companyName: string;
  street: string;
  postalCode: string;
  city: string;
  legalName?: string;
  houseNumber?: string;
  country?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  fax?: string;
  website?: string;
  registrationCourt?: string;
  registrationNumber?: string;
  vatId?: string;
  managingDirector?: string;
  iban?: string;
  bic?: string;
  bankName?: string;
  creditorId?: string;
  documentFooter?: string;
};
export type CaseDocument = {
  id: string;
  type: string;
  status: "DRAFT" | "GENERATED" | "SENT" | "VOIDED";
  filename: string;
  templateVersion: number | null;
  renderedSubject: string | null;
  generatedAt: string;
  template?: { name: string; key: string } | null;
  deliveries?: DocumentDelivery[];
  voidedAt?: string | null;
};

export type DocumentDelivery = {
  channel: "EMAIL";
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  recipient: string | null;
  attemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
};

export type RvgScenario =
  | "SIMPLE_LETTER"
  | "SIMPLE_CASE"
  | "REGULAR_UNCONTESTED"
  | "EXTENSIVE_OR_DIFFICULT";
export type InterestMode = "CONSUMER_DEFAULT" | "COMMERCIAL_DEFAULT" | "CUSTOM";
export type RvgCostInput = {
  calculationDate: string;
  scenario?: RvgScenario;
  customFactor?: string;
  includeExpenseAllowance?: boolean;
  includeVat?: boolean;
  vatRate?: string;
};
export type InterestCostInput = {
  fromDate?: string;
  toDate?: string;
  mode: InterestMode;
  fixedAnnualRate?: string;
  baseRateMargin?: string;
};
export type CostPreview = {
  totalInterest?: string;
  grossTotal?: string;
  feeNet?: string;
  expenseAllowance?: string;
  vatAmount?: string;
  calculationFrom?: string;
  calculationTo?: string;
  periods?: { from: string; to: string; days: number; interestAmount: string }[];
};
