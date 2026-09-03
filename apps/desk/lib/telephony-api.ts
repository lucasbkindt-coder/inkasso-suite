export type TelephonyProviderType = "DIRECT_WEBRTC" | "GATEWAY_REQUIRED" | "MOCK";
export type TelephonyRegistrationStatus = "NOT_CONFIGURED" | "DISCONNECTED" | "REGISTERING" | "REGISTERED" | "ERROR";
export type AgentPresenceStatus = "OFFLINE" | "AVAILABLE" | "BUSY" | "WRAP_UP" | "DO_NOT_DISTURB";
export type CallStatus = "CREATED" | "RINGING" | "ANSWERED" | "HELD" | "ENDED" | "MISSED" | "FAILED" | "CANCELLED";
export type CallDisposition = "REACHED" | "NOT_REACHED" | "BUSY" | "NO_ANSWER" | "CALLBACK_REQUESTED" | "PAYMENT_PROMISE" | "INSTALLMENT_REQUEST" | "DISPUTE" | "WRONG_NUMBER" | "OTHER";

export type TelephonyProviderConfig = {
  id: string;
  name: string;
  providerType: TelephonyProviderType;
  status: "NOT_CONFIGURED" | "ACTIVE" | "DISABLED" | "ERROR";
  defaultRegistrar: string | null;
  defaultProxy: string | null;
  defaultDomain: string | null;
  defaultPort: number | null;
  defaultTransport: "UDP" | "TCP" | "TLS" | "WSS" | null;
  defaultWebSocketUrl: string | null;
  defaultStun: string | null;
  defaultTurn: string | null;
};

export type StaffTelephonyAccount = {
  id: string;
  membershipId: string;
  telephonyProviderConfigId: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  extension: string | null;
  authUsername: string | null;
  displayNumber: string | null;
  outboundCallerId: string | null;
  registrarOverride: string | null;
  proxyOverride: string | null;
  domainOverride: string | null;
  portOverride: number | null;
  transportOverride: "UDP" | "TCP" | "TLS" | "WSS" | null;
  webSocketUrlOverride: string | null;
  maxConcurrentCalls: number | null;
  registrationStatus: TelephonyRegistrationStatus;
  lastRegistrationAt: string | null;
  lastRegistrationError: string | null;
  credentialsConfigured: boolean;
  membership: { id: string; user: { displayName: string | null; email: string } };
  providerConfig: TelephonyProviderConfig;
};

export type TelephonyCall = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: CallStatus;
  matchStatus: "MATCHED" | "REVIEW_REQUIRED" | "UNMATCHED";
  remoteNumber: string;
  normalizedRemoteNumber: string;
  localNumber: string | null;
  startedAt: string;
  ringingAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  disposition: CallDisposition | null;
  wrapUpNote: string | null;
  party: { id: string; displayName: string; processingRestrictedAt: string | null } | null;
  case: { id: string; caseNumber: string } | null;
  ticket: { id: string; number: string; subject: string } | null;
  agentMembership: { id: string; user: { displayName: string | null; email: string } } | null;
  staffTelephonyAccount: { id: string; name: string; extension: string | null; displayNumber: string | null } | null;
  providerConfig: { id: string; name: string; providerType: TelephonyProviderType };
  communicationEvent: { id: string; occurredAt: string; summary: string } | null;
  screenPop?: { normalizedRemoteNumber: string; parties: Array<{ id: string; displayName: string; clientCases: Array<{ id: string; caseNumber: string; status: string }>; debtorCases: Array<{ id: string; caseNumber: string; status: string }>; deskTickets: Array<{ id: string; number: string; subject: string; status: string }>; communications: Array<{ id: string; channel: string; direction: string; occurredAt: string; summary: string }> }> };
};

type ApiError = { message?: string | string[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/desk/telephony${path}`, { ...init, cache: "no-store", credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const body = await response.json().catch(() => ({})) as ApiError;
  const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
  throw new Error(message || "Die Telefonie-Anfrage konnte nicht verarbeitet werden.");
}

export const telephonyApi = {
  providerConfigs: () => request<TelephonyProviderConfig[]>("/provider-configs"),
  createProviderConfig: (payload: Record<string, unknown>) => request<TelephonyProviderConfig>("/provider-configs", { method: "POST", body: JSON.stringify(payload) }),
  accounts: (membershipId?: string) => request<StaffTelephonyAccount[]>(`/accounts${membershipId ? `?membershipId=${encodeURIComponent(membershipId)}` : ""}`),
  myTelephony: () => request<{ configured: boolean; accounts: StaffTelephonyAccount[] }>("/me"),
  createAccount: (payload: Record<string, unknown>) => request<StaffTelephonyAccount>("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateAccount: (id: string, payload: Record<string, unknown>) => request<StaffTelephonyAccount>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeAccount: (id: string) => request<void>(`/accounts/${id}`, { method: "DELETE" }),
  setCredentials: (id: string, payload: { sipUsername: string; sipAuthId?: string; sipPassword: string; turnUsername?: string; turnPassword?: string }) => request<{ credentialsConfigured: boolean }>(`/accounts/${id}/credentials`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteCredentials: (id: string) => request<{ credentialsConfigured: boolean }>(`/accounts/${id}/credentials`, { method: "DELETE" }),
  testAccount: (id: string) => request<{ connected: boolean; registrationStatus: TelephonyRegistrationStatus; message: string }>(`/accounts/${id}/test`, { method: "POST" }),
  presence: () => request<{ status: AgentPresenceStatus }>("/presence/me"),
  setPresence: (status: AgentPresenceStatus) => request<{ status: AgentPresenceStatus }>("/presence/me", { method: "PUT", body: JSON.stringify({ status }) }),
  calls: (params = new URLSearchParams()) => request<{ items: TelephonyCall[]; page: number; pageSize: number; total: number; totalPages: number }>(`/calls?${params.toString()}`),
  call: (id: string) => request<TelephonyCall>(`/calls/${id}`),
  outgoing: (payload: { remoteNumber: string; partyId?: string; caseId?: string; ticketId?: string; staffTelephonyAccountId?: string }) => request<TelephonyCall>("/calls/outgoing", { method: "POST", body: JSON.stringify(payload) }),
  mockIncoming: (payload: { remoteNumber: string; staffTelephonyAccountId?: string }) => request<TelephonyCall>("/mock/incoming", { method: "POST", body: JSON.stringify(payload) }),
  action: (id: string, action: "ring" | "answer" | "hold" | "resume" | "mute" | "unmute" | "dtmf" | "end" | "miss" | "fail", digit?: string) => request<TelephonyCall>(`/calls/${id}/action`, { method: "POST", body: JSON.stringify({ action, digit }) }),
  updateCall: (id: string, payload: { partyId?: string | null; caseId?: string | null; ticketId?: string | null; disposition?: CallDisposition; wrapUpNote?: string }) => request<TelephonyCall>(`/calls/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  callbackTask: (id: string, payload: { dueAt?: string; note?: string }) => request(`/calls/${id}/callback-task`, { method: "POST", body: JSON.stringify(payload) }),
};

export const callStatusLabels: Record<CallStatus, string> = { CREATED: "Erstellt", RINGING: "Klingelt", ANSWERED: "Verbunden", HELD: "Gehalten", ENDED: "Beendet", MISSED: "Verpasst", FAILED: "Fehlgeschlagen", CANCELLED: "Abgebrochen" };
export const dispositionLabels: Record<CallDisposition, string> = { REACHED: "Erreicht", NOT_REACHED: "Nicht erreicht", BUSY: "Besetzt", NO_ANSWER: "Keine Antwort", CALLBACK_REQUESTED: "Rückruf gewünscht", PAYMENT_PROMISE: "Zahlungszusage", INSTALLMENT_REQUEST: "Ratenwunsch", DISPUTE: "Forderung bestritten", WRONG_NUMBER: "Falsche Nummer", OTHER: "Sonstiges" };
