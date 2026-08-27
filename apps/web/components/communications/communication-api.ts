import type { Communication, CommunicationChannel, CommunicationsResponse } from "@/types/communication";

const API = "/api";

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, { credentials: "include", ...init });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = typeof body === "object" && body !== null && "message" in body
      ? Array.isArray(body.message) ? body.message.join(" ") : String(body.message)
      : "Die Anfrage konnte nicht verarbeitet werden.";
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function query(page: number, channel?: CommunicationChannel) {
  const params = new URLSearchParams({ page: String(page), limit: "25" });
  if (channel) params.set("channel", channel);
  return params.toString();
}

export const communicationApi = {
  listParty: (partyId: string, page = 1, channel?: CommunicationChannel) =>
    request<CommunicationsResponse>(`/parties/${partyId}/communications?${query(page, channel)}`),
  listCase: (caseId: string, page = 1, channel?: CommunicationChannel) =>
    request<CommunicationsResponse>(`/cases/${caseId}/communications?${query(page, channel)}`),
  create: (partyId: string, form: FormData) =>
    request<Communication>(`/parties/${partyId}/communications`, { method: "POST", body: form }),
  downloadUrl: (communicationId: string, attachmentId: string) =>
    `${API}/communications/${communicationId}/attachments/${attachmentId}/download`,
};
