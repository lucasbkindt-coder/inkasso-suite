export type DeskTicketStatus = "OPEN" | "PENDING" | "WAITING" | "RESOLVED" | "CLOSED";
export type DeskTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type DeskTicket = {
  id: string;
  number: string;
  subject: string;
  status: DeskTicketStatus;
  priority: DeskTicketPriority;
  category: string | null;
  partyId: string | null;
  caseId: string | null;
  assigneeMembershipId: string | null;
  teamId: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  party: { id: string; displayName: string; type: "PERSON" | "COMPANY"; processingRestrictedAt: string | null } | null;
  case: { id: string; caseNumber: string } | null;
  assigneeMembership: { id: string; user: { displayName: string | null; email: string } } | null;
  team: { id: string; name: string } | null;
};

export type DeskTicketDetail = DeskTicket & {
  createdByMembership: { id: string; user: { displayName: string | null; email: string } } | null;
  communications: {
    id: string;
    direction: "INBOUND" | "OUTBOUND" | "INTERNAL";
    channel: "PHONE" | "EMAIL" | "LETTER" | "PORTAL" | "IN_PERSON" | "INTERNAL" | "OTHER";
    occurredAt: string;
    subject: string | null;
    summary: string;
    createdByMembership: { id: string; user: { displayName: string | null; email: string } };
    attachments: { id: string; originalFileName: string; mimeType: string; size: number }[];
  }[];
  openTasks: { id: string; title: string; status: string; priority: string; dueAt: string | null }[];
};

export type DeskDashboard = { mine: number; unassigned: number; open: number; waiting: number; completedToday: number };
export type DeskOptions = { memberships: { id: string; name: string }[]; teams: { id: string; name: string }[] };
export type DeskPartyOption = { id: string; displayName: string; type: "PERSON" | "COMPANY"; roles: { role: "CLIENT" | "DEBTOR" | "CONTACT" | "OTHER" }[] };
export type DeskCaseOption = { id: string; caseNumber: string; clientParty: { id: string; displayName: string }; debtorParty: { id: string; displayName: string } };
export type DeskPartyContext = DeskPartyOption & { processingRestrictedAt: string | null };
export type DeskCaseContext = DeskCaseOption & { debtorParty: DeskCaseOption["debtorParty"] & { processingRestrictedAt: string | null } };
export type DeskTicketList = { items: DeskTicket[]; page: number; pageSize: number; total: number; totalPages: number };

type ApiError = { message?: string | string[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/desk${path}`, { ...init, cache: "no-store", credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const body = await response.json().catch(() => ({})) as ApiError;
  const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
  throw new Error(message || "Die Desk-Anfrage konnte nicht verarbeitet werden.");
}

export type CreateDeskTicketPayload = {
  subject: string;
  priority: DeskTicketPriority;
  category?: string;
  partyId?: string;
  caseId?: string;
  assigneeMembershipId?: string;
  teamId?: string;
  firstInternalNote?: string;
};

export const deskApi = {
  dashboard: () => request<DeskDashboard>("/dashboard"),
  tickets: (params: URLSearchParams) => request<DeskTicketList>(`/tickets?${params.toString()}`),
  ticket: (id: string) => request<DeskTicketDetail>(`/tickets/${id}`),
  create: (payload: CreateDeskTicketPayload) => request<DeskTicketDetail>("/tickets", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<{ subject: string; status: DeskTicketStatus; priority: DeskTicketPriority; category: string | null; partyId: string | null; caseId: string | null; assigneeMembershipId: string | null; teamId: string | null }>) => request<DeskTicketDetail>(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  addNote: (id: string, message: string) => request<DeskTicketDetail>(`/tickets/${id}/internal-notes`, { method: "POST", body: JSON.stringify({ message }) }),
  options: () => request<DeskOptions>("/options"),
  config: () => request<{ publicBaseUrl: string }>("/config"),
  parties: (search: string) => request<DeskPartyOption[]>(`/parties?search=${encodeURIComponent(search)}`),
  cases: (search: string) => request<DeskCaseOption[]>(`/cases?search=${encodeURIComponent(search)}`),
  partyContext: (id: string) => request<DeskPartyContext>(`/context/parties/${id}`),
  caseContext: (id: string) => request<DeskCaseContext>(`/context/cases/${id}`),
};

export const statusLabels: Record<DeskTicketStatus, string> = { OPEN: "Offen", PENDING: "In Bearbeitung", WAITING: "Wartend", RESOLVED: "Gelöst", CLOSED: "Geschlossen" };
export const priorityLabels: Record<DeskTicketPriority, string> = { LOW: "Niedrig", NORMAL: "Normal", HIGH: "Hoch", URGENT: "Dringend" };
