export type PrivacyRequestType = "ACCESS" | "ERASURE" | "RECTIFICATION" | "RESTRICTION";
export type PrivacyRequestStatus = "RECEIVED" | "IDENTITY_CHECK" | "IN_REVIEW" | "WAITING_INFORMATION" | "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED";
export type PrivacyDataAction = "REVIEW" | "RETAIN" | "RESTRICT" | "ANONYMIZE" | "DELETE";

type UserReference = { displayName: string | null; email: string };

export type PrivacyRequest = {
  id: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  receivedAt: string;
  dueAt: string | null;
  identityVerifiedAt: string | null;
  identityVerificationNote: string | null;
  description: string | null;
  notes: string | null;
  decision: string | null;
  decisionReason: string | null;
  completedAt: string | null;
  subjectParty: { id: string; displayName: string; processingRestrictedAt: string | null } | null;
  clientContact: { id: string; firstName: string; lastName: string } | null;
  assignedMembership: { id: string; user: UserReference } | null;
  identityVerifiedBy: { user: UserReference } | null;
  exports: {
    id: string;
    format: string;
    generatedAt: string;
    generatedByMembershipId: string;
    generatedByMembership: { user: UserReference };
  }[];
  reviews: {
    category: string;
    recordCount: number;
    proposedAction: PrivacyDataAction;
    finalAction: PrivacyDataAction | null;
    reason: string | null;
  }[];
};

export type PrivacyListItem = Pick<PrivacyRequest, "id" | "requestType" | "status" | "receivedAt" | "dueAt"> & {
  subjectParty: { displayName: string } | null;
  clientContact: { firstName: string; lastName: string } | null;
  assignedMembership: { user: UserReference } | null;
};

export type PrivacyOptions = {
  parties: { id: string; displayName: string; type: "PERSON" | "COMPANY" }[];
  clientContacts: { id: string; firstName: string; lastName: string; email: string | null; party: { displayName: string } }[];
  assignees: { id: string; user: UserReference }[];
};

export type CreatePrivacyRequest = {
  subjectPartyId?: string;
  clientContactId?: string;
  requestType: PrivacyRequestType;
  receivedAt: string;
  dueAt: string;
  assignedMembershipId?: string;
  description?: string;
};

type ApiError = { message?: string | string[] };

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiError | null;
  return Array.isArray(body?.message)
    ? body.message.join(" ")
    : body?.message ?? "Die Anfrage konnte nicht verarbeitet werden.";
}

async function call<T>(path: string, init?: RequestInit) {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (response.status === 204 ? undefined : await response.json()) as T;
}

async function download(requestId: string, exportId: string) {
  const response = await fetch(`/api/data-subject-requests/${requestId}/access-exports/${exportId}/download`, { credentials: "include" });
  if (!response.ok) throw new Error(await errorMessage(response));
  const disposition = response.headers.get("content-disposition") ?? "";
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `datenschutz-auskunft-${exportId}.json`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const privacyApi = {
  list: () => call<PrivacyListItem[]>("/data-subject-requests"),
  options: () => call<PrivacyOptions>("/data-subject-requests/options"),
  get: (id: string) => call<PrivacyRequest>(`/data-subject-requests/${id}`),
  create: (data: CreatePrivacyRequest) => call<{ id: string }>("/data-subject-requests", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Pick<PrivacyRequest, "status" | "dueAt" | "notes" | "decision" | "decisionReason">> & { assignedMembershipId?: string }) => call<PrivacyRequest>(`/data-subject-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  verify: (id: string, data: { verifiedAt: string; note?: string }) => call(`/data-subject-requests/${id}/identity-verification`, { method: "POST", body: JSON.stringify(data) }),
  export: (id: string) => call(`/data-subject-requests/${id}/access-exports`, { method: "POST" }),
  download,
  review: (id: string, category: string, data: { finalAction: PrivacyDataAction; reason?: string }) => call(`/data-subject-requests/${id}/reviews/${category}`, { method: "PATCH", body: JSON.stringify(data) }),
  restriction: (id: string, apply: boolean, note: string) => call(`/data-subject-requests/${id}/restriction/${apply ? "apply" : "remove"}`, { method: "POST", body: JSON.stringify({ note }) }),
};
