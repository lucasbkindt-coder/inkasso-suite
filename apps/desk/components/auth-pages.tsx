"use client";

import { Headphones, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { staffAuthApi } from "@/lib/staff-auth-api";

const inputClass = "h-10 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function DeskLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [memberships, setMemberships] = React.useState<{ membershipId: string; tenant: { name: string }; roles: string[] }[]>([]);
  const [membershipId, setMembershipId] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setPending(true); setError("");
    try {
      const result = await staffAuthApi.login({ email, password, membershipId: membershipId || undefined });
      if ("requiresTenantSelection" in result) { setMemberships(result.memberships); return; }
      router.replace(result.passwordMustChange ? "/change-password" : "/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Anmeldung fehlgeschlagen."); }
    finally { setPending(false); }
  }

  return <AuthFrame title="Mitarbeiter-Anmeldung" subtitle="Mit dem bestehenden payveo Staff-Konto anmelden."><form className="space-y-4" onSubmit={submit}><label className="grid gap-1.5 text-sm font-medium">E-Mail<input autoComplete="email" className={inputClass} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label><label className="grid gap-1.5 text-sm font-medium">Passwort<input autoComplete="current-password" className={inputClass} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>{memberships.length ? <label className="grid gap-1.5 text-sm font-medium">Mandant<select className={inputClass} onChange={(event) => setMembershipId(event.target.value)} required value={membershipId}><option value="">Bitte auswählen</option>{memberships.map((item) => <option key={item.membershipId} value={item.membershipId}>{item.tenant.name}</option>)}</select></label> : null}{error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}<button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={pending || (memberships.length > 0 && !membershipId)} type="submit">{pending ? <Loader2 className="size-4 animate-spin" /> : null}{memberships.length ? "Mandant auswählen" : "Anmelden"}</button></form></AuthFrame>;
}

export function DeskChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = React.useState(""); const [newPassword, setNewPassword] = React.useState(""); const [pending, setPending] = React.useState(false); const [error, setError] = React.useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await staffAuthApi.changePassword({ currentPassword, newPassword }); router.replace("/"); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Passwort konnte nicht geändert werden."); } finally { setPending(false); } }
  return <AuthFrame title="Passwort ändern" subtitle="Ersetzen Sie Ihr temporäres Passwort, bevor Sie Desk verwenden."><form className="space-y-4" onSubmit={submit}><label className="grid gap-1.5 text-sm font-medium">Aktuelles Passwort<input className={inputClass} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></label><label className="grid gap-1.5 text-sm font-medium">Neues Passwort<input className={inputClass} minLength={12} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /></label>{error ? <p className="text-sm text-red-600">{error}</p> : null}<button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">{pending ? <Loader2 className="size-4 animate-spin" /> : null}Passwort speichern</button></form></AuthFrame>;
}

function AuthFrame({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle: string }) {
  return <main className="grid min-h-screen place-items-center bg-muted/40 p-4"><section className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-lg"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Headphones className="size-5" /></span><div><p className="font-semibold">payveo Desk</p><p className="text-xs text-muted-foreground">Kommunikationsarbeitsbereich</p></div></div><h1 className="mt-8 text-2xl font-semibold">{title}</h1><p className="mb-6 mt-2 text-sm text-muted-foreground">{subtitle}</p>{children}</section></main>;
}
