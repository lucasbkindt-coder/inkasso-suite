export type PartyRole = "CLIENT" | "DEBTOR" | "CONTACT" | "OTHER";
export type PartyType = "PERSON" | "COMPANY";
export type ContactType = "EMAIL" | "PHONE" | "MOBILE" | "FAX" | "WEBSITE";
export type PartyInput = {
  type: PartyType;
  displayName?: string;
  salutation?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  companyName?: string;
  legalForm?: string;
  vatId?: string;
  taxNumber?: string;
  commercialRegister?: string;
  registerNumber?: string;
  roles: PartyRole[];
  addresses: {
    type: "PRIMARY";
    street: string;
    houseNumber?: string;
    addressLine2?: string;
    postalCode: string;
    city: string;
    country: string;
    isPrimary: boolean;
  }[];
  contacts: { type: ContactType; value: string; label?: string; isPrimary: boolean }[];
};
export type PartyDetail = PartyInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export type PortalAccountSummary = { id: string; status: "PENDING_ACTIVATION" | "ACTIVE" | "LOCKED"; loginIdentifier: string; activatedAt: string | null; lastLoginAt: string | null };
export type ClientContact = { id: string; firstName: string; lastName: string; salutation: string | null; title: string | null; position: string | null; email: string | null; phone: string | null; mobile: string | null; isPrimary: boolean; isActive: boolean; notes: string | null; portalAccount: PortalAccountSummary | null };
export type ClientContactInput = { firstName: string; lastName: string; salutation?: string; title?: string; position?: string; email?: string; phone?: string; mobile?: string; notes?: string; isPrimary: boolean; isActive: boolean };
export type PortalActivation = { loginIdentifier: string; activationCode: string; activationUrl: string; expiresAt: string };
const API = "/api";
async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String(body.message)
        : "Die Anfrage konnte nicht verarbeitet werden.";
    throw new Error(message);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
export const partyApi = {
  create: (data: PartyInput) =>
    request<PartyDetail>("/parties", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: PartyInput) =>
    request<PartyDetail>(`/parties/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  activities: (id: string, page = 1) =>
    request<{ items: import("@/components/activity/activity-list").ActivityItem[]; page: number; totalPages: number }>(`/parties/${id}/activities?page=${page}&limit=25`),
};
export const clientContactsApi = {
  list: (clientId: string) => request<ClientContact[]>(`/parties/${clientId}/contacts`),
  create: (clientId: string, data: ClientContactInput) => request<ClientContact>(`/parties/${clientId}/contacts`, { method: "POST", body: JSON.stringify(data) }),
  update: (clientId: string, contactId: string, data: ClientContactInput) => request<ClientContact>(`/parties/${clientId}/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(data) }),
  createPortalAccount: (clientId: string, contactId: string) => request<{ account: PortalAccountSummary; activation: PortalActivation }>(`/parties/${clientId}/contacts/${contactId}/portal-account`, { method: "POST" }),
  reissue: (id: string) => request<PortalActivation>(`/portal-accounts/${id}/activation/reissue`, { method: "POST" }),
  suspend: (id: string) => request<PortalAccountSummary>(`/portal-accounts/${id}/suspend`, { method: "POST" }),
  reactivate: (id: string) => request<PortalAccountSummary>(`/portal-accounts/${id}/reactivate`, { method: "POST" }),
};
