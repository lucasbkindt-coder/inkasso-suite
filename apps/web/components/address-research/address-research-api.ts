import type { AddressResearch, AddressResearchConfidence, AddressResearchOptions, AddressResearchProvider, AddressResearchReason, AddressResearchStatus } from "@/types/address-research";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, cache: "no-store", credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (response.ok) return (response.status === 204 ? undefined : response.json()) as T;
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message;
  throw new Error(message || "Die Adressermittlung konnte nicht verarbeitet werden.");
}

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}

export const addressResearchApi = {
  list: (filters: { status?: AddressResearchStatus; reason?: AddressResearchReason; requestedByMembershipId?: string; partyId?: string; caseId?: string; page?: number } = {}) => request<{ items: AddressResearch[]; meta: { page: number; totalPages: number; total: number } }>(`/address-research?${query(filters)}`),
  options: () => request<AddressResearchOptions>("/address-research/options"),
  get: (id: string) => request<AddressResearch>(`/address-research/${id}`),
  create: (payload: { partyId: string; caseId?: string; reason?: AddressResearchReason; provider: AddressResearchProvider; notes?: string; costAmount?: string; costCurrency?: string }) => request<AddressResearch>("/address-research", { method: "POST", body: JSON.stringify(payload) }),
  run: (id: string) => request<AddressResearch>(`/address-research/${id}/run`, { method: "POST" }),
  addResult: (id: string, payload: { street: string; houseNumber?: string; postalCode: string; city: string; country: string; additionalAddressLine?: string; source: string; sourceReference?: string; sourceDate?: string; confidence: AddressResearchConfidence; qualityReason?: string }) => request(`/address-research/${id}/results`, { method: "POST", body: JSON.stringify(payload) }),
  noResult: (id: string, note?: string) => request(`/address-research/${id}/no-result`, { method: "POST", body: JSON.stringify({ note }) }),
  cancel: (id: string, note?: string) => request(`/address-research/${id}/cancel`, { method: "POST", body: JSON.stringify({ note }) }),
  apply: (id: string, resultId: string) => request<{ sameAddress: boolean; request: AddressResearch }>(`/address-research/${id}/results/${resultId}/apply`, { method: "POST" }),
};
