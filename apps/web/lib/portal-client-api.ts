import type {
  ClientSubmissionDetail,
  ClientSubmissionListItem,
  CreateClientSubmissionInput,
  CreateClientSubmissionResponse,
} from "@/types/client-submission";
import type { CreateInstallmentRequestInput, InstallmentRequest } from "@/types/installment-request";

type ErrorResponse = { message?: string | string[] };

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-risepay-portal-preview": token } : {}),
      ...init?.headers,
    },
  });

  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => ({}))) as ErrorResponse;
  const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
  if (response.status === 401)
    throw new Error("Diese Portalvorschau ist nicht verfügbar oder abgelaufen.");
  throw new Error(message || "Die Anfrage konnte nicht verarbeitet werden.");
}

export const portalClientApi = {
  getInstallmentRequests: (caseId: string, token?: string) => request<InstallmentRequest[]>(`/portal/debtor/cases/${caseId}/installment-requests`, token),
  createInstallmentRequest: (caseId: string, payload: CreateInstallmentRequestInput, token?: string) => request<InstallmentRequest>(`/portal/debtor/cases/${caseId}/installment-requests`, token, { method: "POST", body: JSON.stringify(payload) }),
  getClientSubmissions: (token?: string) =>
    request<ClientSubmissionListItem[]>("/portal/client/submissions", token),
  getClientSubmission: (id: string, token?: string) =>
    request<ClientSubmissionDetail>(`/portal/client/submissions/${id}`, token),
  createClientSubmission: (payload: CreateClientSubmissionInput, token?: string) =>
    request<CreateClientSubmissionResponse>("/portal/client/submissions", token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
