"use client";

import { Loader2, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";

export function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [memberships, setMemberships] = React.useState<{ membershipId: string; tenant: { id: string; name: string; slug: string }; roles: string[] }[]>([]);
  const [membershipId, setMembershipId] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const result = await staffAuthApi.login({ email, password, membershipId: membershipId || undefined });
      if ("requiresTenantSelection" in result) { setMemberships(result.memberships); setMembershipId(""); return; }
      router.replace(result.passwordMustChange ? "/change-password" : "/");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Anmeldedaten ungültig."); }
    finally { setPending(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-muted/30 p-4"><section className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-sm"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Scale className="size-5" /></div><div><p className="font-semibold">payveo</p><p className="text-sm text-muted-foreground">Interner Arbeitsbereich</p></div></div><h1 className="mt-8 text-2xl font-semibold">Mitarbeiter-Anmeldung</h1><p className="mt-2 text-sm text-muted-foreground">Melden Sie sich mit Ihrem internen Benutzerkonto an.</p><form className="mt-6 space-y-4" onSubmit={submit}><label className="grid gap-1 text-sm font-medium">E-Mail<input autoComplete="email" className="h-10 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setEmail(event.target.value)} type="email" value={email} /></label><label className="grid gap-1 text-sm font-medium">Passwort<input autoComplete="current-password" className="h-10 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setPassword(event.target.value)} type="password" value={password} /></label>{memberships.length ? <label className="grid gap-1 text-sm font-medium">Mandant<select className="h-10 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setMembershipId(event.target.value)} value={membershipId}><option value="">Bitte auswählen</option>{memberships.map((membership) => <option key={membership.membershipId} value={membership.membershipId}>{membership.tenant.name}</option>)}</select></label> : null}{error ? <p className="text-sm text-destructive">{error}</p> : null}<Button className="w-full" disabled={pending || !email || !password || (memberships.length > 0 && !membershipId)} type="submit">{pending ? <><Loader2 className="size-4 animate-spin" /> Anmeldung läuft …</> : memberships.length ? "Mandant auswählen" : "Anmelden"}</Button></form></section></main>;
}
