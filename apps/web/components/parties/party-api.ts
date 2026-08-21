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
const API = process.env.NEXT_PUBLIC_API_URL ?? "/api";
async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
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
};
