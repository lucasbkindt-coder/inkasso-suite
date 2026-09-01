import type { CreditReport, CreditReportEligibility, CreditReportOptions, CreditReportProvider, CreditReportStatus } from "@/types/credit-report";
async function request<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`/api${path}`, { ...init, cache: "no-store", credentials: "include", headers: { "content-type": "application/json", ...init?.headers } }); if (response.ok) return (response.status === 204 ? undefined : response.json()) as T; const body = await response.json().catch(() => null) as { message?: string | string[] } | null; const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message; throw new Error(message || "Die Auskunfteiprüfung konnte nicht verarbeitet werden."); }
function query(values: Record<string, string | number | undefined>) { const params = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value)); return params.toString(); }
export const creditReportApi = {
  list: (filters: { status?: CreditReportStatus; provider?: CreditReportProvider; eligibility?: CreditReportEligibility; partyId?: string; caseId?: string } = {}) => request<{ items: CreditReport[]; meta: { total: number } }>(`/credit-reports?${query(filters)}`),
  options: () => request<CreditReportOptions>("/credit-reports/options"),
  get: (id: string) => request<CreditReport>(`/credit-reports/${id}`),
  create: (caseId: string, provider: CreditReportProvider) => request<CreditReport>("/credit-reports", { method: "POST", body: JSON.stringify({ caseId, provider }) }),
  check: (id: string) => request<CreditReport>(`/credit-reports/${id}/eligibility`, { method: "POST" }),
  approve: (id: string, reason: string) => request<CreditReport>(`/credit-reports/${id}/approve`, { method: "POST", body: JSON.stringify({ reason }) }),
  revoke: (id: string, reason: string) => request<CreditReport>(`/credit-reports/${id}/revoke`, { method: "POST", body: JSON.stringify({ reason }) }),
  cancel: (id: string, reason: string) => request<CreditReport>(`/credit-reports/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }),
};
