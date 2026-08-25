import type { StaffSession } from "@/lib/staff-auth-api";

export type StaffMember = Omit<StaffSession, "authenticated">;
export type StaffRole = { id: string; name: string; description: string | null };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: "include", headers: { "content-type": "application/json", ...init?.headers } });
  if (response.ok) return (await response.json()) as T;
  const body = await response.json().catch(() => ({})) as { message?: string | string[] };
  const message = Array.isArray(body.message) ? body.message.join(" ") : body.message;
  throw new Error(message || "Die Anfrage konnte nicht verarbeitet werden.");
}

export const staffAdminApi = {
  list: () => request<StaffMember[]>("/users"),
  roles: () => request<StaffRole[]>("/staff/roles"),
  create: (payload: { displayName: string; email: string; initialPassword: string; roleIds: string[] }) => request<StaffMember>("/users", { method: "POST", body: JSON.stringify(payload) }),
  update: (membershipId: string, payload: { status?: StaffMember["membership"]["status"]; roleIds?: string[] }) => request<StaffMember>(`/users/${membershipId}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
