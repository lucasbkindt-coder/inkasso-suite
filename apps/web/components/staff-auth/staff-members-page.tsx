"use client";

import { Loader2, Pencil, Plus, UserX } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

import { staffAdminApi, type StaffMember, type StaffRole } from "./staff-admin-api";

export function StaffMembersPage() {
  const [members, setMembers] = React.useState<StaffMember[]>([]);
  const [roles, setRoles] = React.useState<StaffRole[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<StaffMember | null>(null);
  const load = React.useCallback(async () => {
    setLoading(true);
    try { const [memberValues, roleValues] = await Promise.all([staffAdminApi.list(), staffAdminApi.roles()]); setMembers(memberValues); setRoles(roleValues); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Benutzer konnten nicht geladen werden."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  async function suspend(member: StaffMember) {
    if (!window.confirm(`${member.user.email} wirklich suspendieren?`)) return;
    try { await staffAdminApi.update(member.membership.id, { status: "SUSPENDED" }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Benutzer konnte nicht suspendiert werden."); }
  }
  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary">payveo · Administration</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Benutzer</h1><p className="mt-2 text-sm text-muted-foreground">Mitarbeiter, Rollen und Mitgliedschaften dieses Mandanten.</p></div><Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Mitarbeiter anlegen</Button></div>
    {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p> : null}
    <MemberDialog onCreated={() => { setCreateOpen(false); void load(); }} onOpenChange={setCreateOpen} open={createOpen} roles={roles} />
    <RolesDialog member={editing} onOpenChange={setEditing} onSaved={() => { setEditing(null); void load(); }} roles={roles} />
    {loading ? <p className="text-sm text-muted-foreground">Benutzer werden geladen …</p> : <div className="overflow-x-auto rounded-xl border bg-card"><table className="min-w-[880px] w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">E-Mail</th><th className="p-3">Status</th><th className="p-3">Rollen</th><th className="p-3">Teams</th><th className="p-3">Mitglied seit</th><th className="p-3">Aktion</th></tr></thead><tbody>{members.map((member) => <tr className="border-b last:border-0" key={member.membership.id}><td className="p-3 font-medium">{member.user.displayName ?? "—"}</td><td className="p-3">{member.user.email}</td><td className="p-3">{member.membership.status}</td><td className="p-3">{member.roles.join(", ") || "—"}</td><td className="p-3">{member.teams.map((team) => team.name).join(", ") || "—"}</td><td className="p-3">{new Intl.DateTimeFormat("de-DE").format(new Date(member.membership.createdAt))}</td><td className="p-3"><div className="flex flex-wrap gap-2"><Button onClick={() => setEditing(member)} variant="outline"><Pencil className="size-4" /> Rollen</Button>{member.membership.status === "ACTIVE" ? <Button onClick={() => void suspend(member)} variant="outline"><UserX className="size-4" /> Suspendieren</Button> : null}</div></td></tr>)}</tbody></table></div>}
  </section>;
}

function MemberDialog({ open, onOpenChange, onCreated, roles }: { open: boolean; onOpenChange: (value: boolean) => void; onCreated: () => void; roles: StaffRole[] }) {
  const [name, setName] = React.useState(""); const [email, setEmail] = React.useState(""); const [password, setPassword] = React.useState(""); const [roleIds, setRoleIds] = React.useState<string[]>([]); const [pending, setPending] = React.useState(false); const [error, setError] = React.useState("");
  if (!open) return null;
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await staffAdminApi.create({ displayName: name, email, initialPassword: password, roleIds }); onCreated(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Mitarbeiter konnte nicht angelegt werden."); } finally { setPending(false); } }
  return <MemberFormDialog error={error} onClose={() => onOpenChange(false)} onSubmit={submit} pending={pending} roleIds={roleIds} roles={roles} setRoleIds={setRoleIds} title="Mitarbeiter anlegen"><label className="grid gap-1 text-sm font-medium">Name<input className="h-10 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setName(event.target.value)} required value={name} /></label><label className="grid gap-1 text-sm font-medium">E-Mail<input className="h-10 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label className="grid gap-1 text-sm font-medium">Temporäres Passwort<input className="h-10 rounded-lg border bg-background px-3 font-normal" minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label></MemberFormDialog>;
}

function RolesDialog({ member, onOpenChange, onSaved, roles }: { member: StaffMember | null; onOpenChange: (member: StaffMember | null) => void; onSaved: () => void; roles: StaffRole[] }) {
  const [roleIds, setRoleIds] = React.useState<string[]>([]); const [pending, setPending] = React.useState(false); const [error, setError] = React.useState("");
  React.useEffect(() => { if (member) setRoleIds(roles.filter((role) => member.roles.includes(role.name)).map((role) => role.id)); }, [member, roles]);
  if (!member) return null;
  const membershipId = member.membership.id;
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await staffAdminApi.update(membershipId, { roleIds }); onSaved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Rollen konnten nicht gespeichert werden."); } finally { setPending(false); } }
  return <MemberFormDialog error={error} onClose={() => onOpenChange(null)} onSubmit={submit} pending={pending} roleIds={roleIds} roles={roles} setRoleIds={setRoleIds} title={`Rollen für ${member.user.displayName ?? member.user.email}`} />;
}

function MemberFormDialog({ children, error, onClose, onSubmit, pending, roleIds, roles, setRoleIds, title }: { children?: React.ReactNode; error: string; onClose: () => void; onSubmit: (event: React.FormEvent) => void; pending: boolean; roleIds: string[]; roles: StaffRole[]; setRoleIds: React.Dispatch<React.SetStateAction<string[]>>; title: string }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-4"><form className="w-full max-w-lg space-y-4 rounded-2xl border bg-card p-6 shadow-xl" onSubmit={onSubmit}><div className="flex justify-between"><h2 className="text-lg font-semibold">{title}</h2><Button onClick={onClose} type="button" variant="ghost">Schließen</Button></div>{children}<fieldset className="grid gap-2"><legend className="text-sm font-medium">Rollen</legend>{roles.map((role) => <label className="flex items-center gap-2 text-sm" key={role.id}><input checked={roleIds.includes(role.id)} onChange={(event) => setRoleIds((current) => event.target.checked ? [...current, role.id] : current.filter((id) => id !== role.id))} type="checkbox" />{role.name}</label>)}</fieldset>{error ? <p className="text-sm text-destructive">{error}</p> : null}<Button disabled={pending} type="submit">{pending ? <><Loader2 className="size-4 animate-spin" /> Speichert …</> : "Speichern"}</Button></form></div>;
}
