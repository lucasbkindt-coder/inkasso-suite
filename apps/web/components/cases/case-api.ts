import type {
  Case,
  CasesResponse,
  CreateCaseInput,
  CreateLedgerEntryInput,
  CreatePaymentInput,
  CaseDocument,
  DocumentTemplate,
  DocumentTemplateInput,
  DocumentPreview,
  TenantDocumentSettings,
  TenantDocumentSettingsInput,
  InterestCostInput,
  LedgerEntry,
  LedgerResponse,
  PaymentApplyResponse,
  RvgCostInput,
  UpdateCaseInput,
} from "@/types/case";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type PartyOption = {
  id: string;
  displayName: string;
  type: "PERSON" | "COMPANY";
  roles: { role: "CLIENT" | "DEBTOR" | "CONTACT" | "OTHER" }[];
};

type PartiesResponse = { items: PartyOption[] };
export type CasesQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  phase?: string;
  priority?: string;
  clientPartyId?: string;
  debtorPartyId?: string;
  deleted?: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? Array.isArray(body.message)
          ? body.message.join(" ")
          : String(body.message)
        : "Die Anfrage konnte nicht verarbeitet werden.";
    throw new Error(message);
  }
  return (response.status === 204 ? undefined : response.json()) as T;
}

function isLedgerResponse(value: unknown): value is LedgerResponse {
  if (typeof value !== "object" || value === null || !("items" in value) || !("totals" in value))
    return false;
  const totals = value.totals;
  if (typeof totals !== "object" || totals === null) return false;
  const requiredTotals = [
    "totalDebit",
    "totalCredit",
    "balance",
    "openCosts",
    "openInterest",
    "openPrincipal",
    "totalOpen",
    "unallocatedPayments",
  ];
  return requiredTotals.every(
    (key) => key in totals && typeof totals[key as keyof typeof totals] === "string",
  );
}

async function getLedger(caseId: string) {
  const response = await request<unknown>(`/cases/${caseId}/ledger`);
  if (!isLedgerResponse(response))
    throw new Error(
      "Die API liefert eine veraltete Forderungskonto-Antwort. Bitte die RisePay-API neu starten.",
    );
  return response;
}

function queryString(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export const caseApi = {
  getCases: (query: CasesQuery = {}) => {
    const suffix = queryString(query);
    return request<CasesResponse>(`/cases${suffix ? `?${suffix}` : ""}`);
  },
  getCase: (id: string) => request<Case>(`/cases/${id}`),
  getCaseByNumber: (caseNumber: string) =>
    request<Case>(`/cases/by-number?${queryString({ caseNumber })}`),
  createCase: (payload: CreateCaseInput) =>
    request<Case>("/cases", { method: "POST", body: JSON.stringify(payload) }),
  updateCase: (id: string, payload: UpdateCaseInput) =>
    request<Case>(`/cases/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCase: (id: string) => request<void>(`/cases/${id}`, { method: "DELETE" }),
  restoreCase: (id: string) => request<Case>(`/cases/${id}/restore`, { method: "POST" }),
  getParties: (role: "CLIENT" | "DEBTOR", search?: string) =>
    request<PartiesResponse>(`/parties?${queryString({ role, search, limit: 100 })}`),
  getLedger,
  getPayments: (caseId: string) =>
    request<{ items: PaymentApplyResponse["payment"][] }>(`/cases/${caseId}/payments`),
  getDocumentTemplates: (includeArchived = false) =>
    request<DocumentTemplate[]>(
      `/document-templates${includeArchived ? "?includeArchived=true" : ""}`,
    ),
  getDocumentTemplate: (id: string) => request<DocumentTemplate>(`/document-templates/${id}`),
  createDocumentTemplate: (payload: DocumentTemplateInput) =>
    request<DocumentTemplate>("/document-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createDocumentTemplateVersion: (id: string, payload: DocumentTemplateInput) =>
    request<DocumentTemplate>(`/document-templates/${id}/version`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  archiveDocumentTemplate: (id: string) =>
    request<DocumentTemplate>(`/document-templates/${id}/archive`, { method: "POST" }),
  getTenantDocumentSettings: () =>
    request<TenantDocumentSettings | null>("/tenant-document-settings"),
  saveTenantDocumentSettings: (payload: TenantDocumentSettingsInput) =>
    request<TenantDocumentSettings>("/tenant-document-settings", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getDocuments: (caseId: string) => request<CaseDocument[]>(`/cases/${caseId}/documents`),
  previewDocument: (caseId: string, templateId: string) =>
    request<DocumentPreview>(`/cases/${caseId}/documents/preview`, {
      method: "POST",
      body: JSON.stringify({ templateId }),
    }),
  generateDocument: (caseId: string, templateId: string) =>
    request<CaseDocument>(`/cases/${caseId}/documents/generate`, {
      method: "POST",
      body: JSON.stringify({ templateId }),
    }),
  voidDocument: (caseId: string, id: string) =>
    request<CaseDocument>(`/cases/${caseId}/documents/${id}/void`, { method: "POST" }),
  documentDownloadUrl: (caseId: string, id: string) =>
    `${apiUrl}/cases/${caseId}/documents/${id}/download`,
  createLedgerEntry: (caseId: string, payload: CreateLedgerEntryInput) =>
    request<LedgerEntry>(`/cases/${caseId}/ledger`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  applyPayment: (caseId: string, payload: CreatePaymentInput) =>
    request<PaymentApplyResponse>(`/cases/${caseId}/payments`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reverseLedgerEntry: (caseId: string, entryId: string) =>
    request<LedgerEntry>(`/cases/${caseId}/ledger/${entryId}/reverse`, { method: "POST" }),
  previewRvgCosts: (caseId: string, payload: RvgCostInput) =>
    request(`/cases/${caseId}/costs/rvg/preview`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  applyRvgCosts: (caseId: string, payload: RvgCostInput) =>
    request(`/cases/${caseId}/costs/rvg/apply`, { method: "POST", body: JSON.stringify(payload) }),
  previewInterestCosts: (caseId: string, payload: InterestCostInput) =>
    request(`/cases/${caseId}/costs/interest/preview`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  applyInterestCosts: (caseId: string, payload: InterestCostInput) =>
    request(`/cases/${caseId}/costs/interest/apply`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export type { PartyOption };
