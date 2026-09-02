import type { DeskCaseOption, DeskPartyOption, DeskTicketStatus } from "./desk-api";

type ApiError = { message?: string | string[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const response = await fetch(`/api/desk/mail${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: isForm ? init?.headers : { "content-type": "application/json", ...init?.headers },
  });
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const body = (await response.json().catch(() => ({}))) as ApiError;
  const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
  throw new Error(message || "Die Mail-Anfrage konnte nicht verarbeitet werden.");
}

export type MailAccount = {
  id: string;
  name: string;
  emailAddress: string;
  displayName: string | null;
  provider: "MOCK" | "GENERIC_SMTP_IMAP";
  status: "NOT_CONFIGURED" | "ACTIVE" | "DISABLED" | "ERROR";
  isDefault: boolean;
  inboundEnabled: boolean;
  outboundEnabled: boolean;
  credential: { id: string; encryptionVersion: number; updatedAt: string } | null;
};

export type InboxMessage = {
  id: string;
  subject: string;
  fromAddress: string;
  receivedAt: string;
  deliveryStatus: "PENDING" | "SENT" | "DELIVERED" | "BOUNCED" | "FAILED";
  mailAccount: { name: string; emailAddress: string };
  communicationEvent: {
    deskTicket: {
      id: string;
      number: string;
      status: DeskTicketStatus;
      unreadAt: string | null;
      party: Pick<DeskPartyOption, "id" | "displayName"> | null;
      case: Pick<DeskCaseOption, "id" | "caseNumber"> | null;
      assigneeMembership: { user: { displayName: string | null; email: string } } | null;
    } | null;
  };
};

export type MailReview = {
  id: string;
  reason:
    | "PARTY_AMBIGUOUS"
    | "CASE_AMBIGUOUS"
    | "THREAD_AMBIGUOUS"
    | "MALFORMED_MAIL"
    | "BLOCKED_ATTACHMENT"
    | "PROCESSING_RESTRICTION"
    | "UNMATCHED_CONTEXT";
  status: "PENDING" | "RESOLVED" | "IGNORED";
  summary: string;
  createdAt: string;
  mailMessage: { subject: string; fromAddress: string; receivedAt: string } | null;
  deskTicket: { id: string; number: string; subject: string } | null;
  suggestedParty: { id: string; displayName: string } | null;
  suggestedCase: { id: string; caseNumber: string } | null;
};

export type MailDraft = {
  id: string;
  status: "DRAFT" | "QUEUED" | "SENT" | "CANCELLED";
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  bodyPlain: string;
  version: number;
  updatedAt: string;
  mailAccount: { name: string; emailAddress: string };
  outboundJob: {
    id: string;
    status: "QUEUED" | "PROCESSING" | "SENT" | "FAILED" | "RETRY" | "CANCELLED";
    attempts: number;
    nextAttemptAt: string;
    lastErrorMessage: string | null;
  } | null;
};

export type CannedResponse = { id: string; name: string; subject: string | null; body: string };
export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const deskMailApi = {
  accounts: () => request<MailAccount[]>("/accounts"),
  inbox: (params: URLSearchParams) => request<Paged<InboxMessage>>(`/inbox?${params.toString()}`),
  reviews: (params: URLSearchParams) => request<Paged<MailReview>>(`/reviews?${params.toString()}`),
  resolveReview: (
    id: string,
    payload: {
      ticketId?: string;
      partyId?: string;
      caseId?: string;
      ignored?: boolean;
      note?: string;
    },
  ) => request(`/reviews/${id}/resolve`, { method: "POST", body: JSON.stringify(payload) }),
  markRead: (ticketId: string) =>
    request(`/tickets/${ticketId}/read`, { method: "POST", body: "{}" }),
  drafts: (ticketId: string) => request<MailDraft[]>(`/tickets/${ticketId}/drafts`),
  createDraft: (payload: {
    ticketId: string;
    mailAccountId: string;
    toAddresses: string[];
    ccAddresses: string[];
    subject: string;
    bodyPlain: string;
  }) => request<MailDraft>("/drafts", { method: "POST", body: JSON.stringify(payload) }),
  updateDraft: (
    id: string,
    payload: {
      version: number;
      toAddresses: string[];
      ccAddresses: string[];
      subject: string;
      bodyPlain: string;
    },
  ) => request<MailDraft>(`/drafts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addAttachments: (id: string, files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("attachments", file);
    return request(`/drafts/${id}/attachments`, { method: "POST", body: form });
  },
  queue: (id: string) =>
    request<{ id: string }>(`/drafts/${id}/queue`, { method: "POST", body: "{}" }),
  process: (id: string) =>
    request<{ status: string; nextAttemptAt?: string | null }>(`/outbound-jobs/${id}/process`, {
      method: "POST",
      body: "{}",
    }),
  cannedResponses: () => request<CannedResponse[]>("/canned-responses"),
};
