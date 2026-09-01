export type ZohoDeskStatus = {
  configured: boolean;
  region: string;
  missing: string[];
  configurationError: string | null;
  connected: boolean | null;
  organizationReachable: boolean | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

export type ZohoDeskContact = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
};

export type ZohoDeskTicket = {
  id: string;
  ticketNumber: string | null;
  subject: string;
  status: string;
  contact: { id: string | null; name: string | null; email: string | null } | null;
  createdTime: string | null;
  modifiedTime: string | null;
  webUrl: string;
};

export type ZohoDeskContactLink = {
  id: string;
  externalId: string;
  metadata: {
    displayName?: string;
    email?: string | null;
    phone?: string | null;
    mobile?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type ZohoDeskTicketLink = {
  id: string;
  externalId: string;
  metadata: {
    ticketNumber?: string | null;
    subject?: string;
    status?: string;
    contact?: { name?: string | null } | null;
    createdTime?: string | null;
    modifiedTime?: string | null;
  } | null;
  webUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiError = { message?: string | string[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/integrations/zoho-desk${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const payload = (await response.json().catch(() => ({}))) as ApiError;
  const message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
  throw new Error(message || "Die Zoho-Desk-Anfrage konnte nicht verarbeitet werden.");
}

export const zohoDeskApi = {
  status: () => request<ZohoDeskStatus>("/status"),
  test: () => request<ZohoDeskStatus>("/test", { method: "POST" }),
  searchContacts: (query: string) =>
    request<ZohoDeskContact[]>(`/contacts?query=${encodeURIComponent(query)}`),
  searchTickets: (query: string) =>
    request<ZohoDeskTicket[]>(`/tickets?query=${encodeURIComponent(query)}`),
  partyLink: (partyId: string) =>
    request<ZohoDeskContactLink | null>(`/parties/${partyId}/contact-link`),
  linkParty: (partyId: string, externalId: string) =>
    request<ZohoDeskContactLink>(`/parties/${partyId}/contact-link`, {
      method: "POST",
      body: JSON.stringify({ externalId }),
    }),
  unlinkParty: (partyId: string, linkId: string) =>
    request<void>(`/parties/${partyId}/contact-link/${linkId}`, { method: "DELETE" }),
  caseLinks: (caseId: string) => request<ZohoDeskTicketLink[]>(`/cases/${caseId}/ticket-links`),
  linkCase: (caseId: string, externalId: string) =>
    request<ZohoDeskTicketLink>(`/cases/${caseId}/ticket-links`, {
      method: "POST",
      body: JSON.stringify({ externalId }),
    }),
  unlinkCase: (caseId: string, linkId: string) =>
    request<void>(`/cases/${caseId}/ticket-links/${linkId}`, { method: "DELETE" }),
};
