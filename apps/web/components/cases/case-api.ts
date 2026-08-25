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
import type { CaseTask, CreateTaskInput, TasksResponse, UpdateTaskInput } from "@/types/task";
import type { DashboardSummary } from "@/types/dashboard";
import type {
  AcceptClientSubmissionInput,
  AcceptClientSubmissionResponse,
  ClientSubmissionsResponse,
  ClientSubmissionStatus,
  DebtorCandidate,
  InternalClientSubmission,
} from "@/types/client-submission";
import type { InstallmentRequest, InstallmentRequestStatus } from "@/types/installment-request";
import type { InstallmentPlan } from "@/types/installment-plan";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

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
  assignedMembershipId?: string;
  mine?: boolean;
  unassigned?: boolean;
  deleted?: boolean;
};
export type TasksQuery = {
  caseId?: string;
  status?: string;
  type?: string;
  priority?: string;
  assignedMembershipId?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
  overdue?: boolean;
  today?: boolean;
  upcoming?: boolean;
  page?: number;
  pageSize?: number;
};
export type ClientSubmissionsQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ClientSubmissionStatus;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
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
      "Die API liefert eine veraltete Forderungskonto-Antwort. Bitte die payveo-API neu starten.",
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
  getInstallmentRequests: () => request<InstallmentRequest[]>("/installment-requests"),
  getInstallmentRequest: (id: string) => request<InstallmentRequest>(`/installment-requests/${id}`),
  reviewInstallmentRequest: (id: string) => request<InstallmentRequest>(`/installment-requests/${id}/review`, { method: "POST" }),
  approveInstallmentRequest: (id: string) => request<InstallmentRequest>(`/installment-requests/${id}/approve`, { method: "POST" }),
  rejectInstallmentRequest: (id: string) => request<InstallmentRequest>(`/installment-requests/${id}/reject`, { method: "POST" }),
  createInstallmentPlan: (id: string) => request<InstallmentPlan>(`/installment-requests/${id}/create-plan`, { method: "POST" }),
  getInstallmentPlans: () => request<InstallmentPlan[]>("/installment-plans"),
  getInstallmentPlan: (id: string) => request<InstallmentPlan>(`/installment-plans/${id}`),
  activateInstallmentPlan: (id: string) => request<InstallmentPlan>(`/installment-plans/${id}/activate`, { method: "POST" }),
  cancelInstallmentPlan: (id: string) => request<InstallmentPlan>(`/installment-plans/${id}/cancel`, { method: "POST" }),
  defaultInstallmentPlan: (id: string) => request<InstallmentPlan>(`/installment-plans/${id}/default`, { method: "POST" }),
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  getCases: (query: CasesQuery = {}) => {
    const suffix = queryString(query);
    return request<CasesResponse>(`/cases${suffix ? `?${suffix}` : ""}`);
  },
  getClientSubmissions: (query: ClientSubmissionsQuery = {}) => {
    const suffix = queryString(query);
    return request<ClientSubmissionsResponse>(`/client-submissions${suffix ? `?${suffix}` : ""}`);
  },
  getClientSubmission: (id: string) =>
    request<InternalClientSubmission>(`/client-submissions/${id}`),
  getSubmissionDebtorCandidates: (id: string) =>
    request<DebtorCandidate[]>(`/client-submissions/${id}/debtor-candidates`),
  reviewClientSubmission: (id: string) =>
    request<InternalClientSubmission>(`/client-submissions/${id}/review`, { method: "POST" }),
  rejectClientSubmission: (id: string, rejectionReason?: string) =>
    request<InternalClientSubmission>(`/client-submissions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectionReason: rejectionReason || undefined }),
    }),
  acceptClientSubmission: (id: string, payload: AcceptClientSubmissionInput) =>
    request<AcceptClientSubmissionResponse>(`/client-submissions/${id}/accept`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getCase: (id: string) => request<Case>(`/cases/${id}`),
  getCaseByNumber: (caseNumber: string) =>
    request<Case>(`/cases/by-number?${queryString({ caseNumber })}`),
  createCase: (payload: CreateCaseInput) =>
    request<Case>("/cases", { method: "POST", body: JSON.stringify(payload) }),
  updateCase: (id: string, payload: UpdateCaseInput) =>
    request<Case>(`/cases/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCase: (id: string) => request<void>(`/cases/${id}`, { method: "DELETE" }),
  restoreCase: (id: string) => request<Case>(`/cases/${id}/restore`, { method: "POST" }),
  assignCase: (id: string, membershipId: string | null) =>
    request<Case>(`/cases/${id}/assignee`, { method: "POST", body: JSON.stringify({ membershipId }) }),
  getCaseStatusTransitions: (id: string) =>
    request<{ currentStatus: Case["status"]; allowedTargetStatuses: Case["status"][] }>(`/cases/${id}/status-transitions`),
  transitionCaseStatus: (id: string, targetStatus: Case["status"]) =>
    request<Case>(`/cases/${id}/status-transition`, { method: "POST", body: JSON.stringify({ targetStatus }) }),
  getStaffMembers: () => request<{ membershipId: string; displayName: string; email: string; roles: string[] }[]>("/staff/members"),
  getTasks: (query: TasksQuery = {}) => {
    const suffix = queryString(query);
    return request<TasksResponse>(`/tasks${suffix ? `?${suffix}` : ""}`);
  },
  createTask: (payload: CreateTaskInput) =>
    request<CaseTask>("/tasks", { method: "POST", body: JSON.stringify(payload) }),
  updateTask: (id: string, payload: UpdateTaskInput) =>
    request<CaseTask>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  completeTask: (id: string) => request<CaseTask>(`/tasks/${id}/complete`, { method: "POST" }),
  reopenTask: (id: string) => request<CaseTask>(`/tasks/${id}/reopen`, { method: "POST" }),
  cancelTask: (id: string) => request<CaseTask>(`/tasks/${id}/cancel`, { method: "POST" }),
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
  previewDocument: (caseId: string, templateId: string, paymentDueDate?: string) =>
    request<DocumentPreview>(`/cases/${caseId}/documents/preview`, {
      method: "POST",
      body: JSON.stringify({ templateId, paymentDueDate: paymentDueDate || undefined }),
    }),
  generateDocument: (caseId: string, templateId: string, paymentDueDate?: string) =>
    request<CaseDocument>(`/cases/${caseId}/documents/generate`, {
      method: "POST",
      body: JSON.stringify({ templateId, paymentDueDate: paymentDueDate || undefined }),
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
