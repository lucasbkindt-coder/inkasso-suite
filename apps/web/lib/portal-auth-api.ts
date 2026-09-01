export type PortalSession = {
  authenticated: true;
  portalType: "CLIENT" | "DEBTOR";
  partyId: string;
  clientContactId?: string;
  clientContactName?: string;
};

type PortalAuthError = { message?: string | string[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const payload = (await response.json().catch(() => ({}))) as PortalAuthError;
  const detail = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
  if (response.status === 401) throw new Error("Anmeldedaten ungültig oder Sitzung abgelaufen.");
  throw new Error(detail || "Die Anfrage konnte nicht verarbeitet werden.");
}

export const portalAuthApi = {
  getPortalSession: () => request<PortalSession>("/portal/auth/session"),
  activatePortal: (payload: {
    loginIdentifier: string;
    activationCode: string;
    newPassword: string;
    confirmPassword: string;
  }) => request<{ portalType: "CLIENT" | "DEBTOR"; status: "ACTIVE" }>("/portal/auth/activate", { method: "POST", body: JSON.stringify(payload) }),
  loginPortal: (payload: { loginIdentifier: string; password: string }) =>
    request<{ portalType: "CLIENT" | "DEBTOR"; expiresAt: string }>("/portal/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logoutPortal: () => request<void>("/portal/auth/logout", { method: "POST" }),
};
