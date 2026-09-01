export type StaffSession = {
  authenticated: true;
  user: { id: string; email: string; displayName: string | null; passwordMustChange: boolean };
  membership: { id: string; status: string };
  tenant: { id: string; name: string; slug: string };
  roles: string[];
  permissions: string[];
  teams: { id: string; name: string }[];
  passwordMustChange: boolean;
};

type LoginResult = StaffSession | { requiresTenantSelection: true; memberships: { membershipId: string; tenant: { id: string; name: string; slug: string }; roles: string[] }[] };
type ApiError = { message?: string | string[] };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, cache: "no-store", credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (response.ok) return (response.status === 204 ? undefined : await response.json()) as T;
  const body = await response.json().catch(() => ({})) as ApiError;
  const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
  throw new Error(response.status === 401 ? "Anmeldedaten ungültig." : message || "Die Anfrage konnte nicht verarbeitet werden.");
}

export const staffAuthApi = {
  login: (payload: { email: string; password: string; membershipId?: string }) => request<LoginResult>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  session: () => request<StaffSession>("/auth/session"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) => request<void>("/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
};
