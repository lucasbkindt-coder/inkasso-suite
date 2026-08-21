"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { portalAuthApi } from "@/lib/portal-auth-api";

const inputClass = "mt-1 w-full rounded-lg border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2";

export function PortalLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [loginIdentifier, setLoginIdentifier] = React.useState(search.get("login") ?? "");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const session = await portalAuthApi.loginPortal({ loginIdentifier, password });
      router.replace(session.portalType === "DEBTOR" ? "/portal/schuldner" : "/portal/mandant");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Anmeldung nicht möglich.");
    } finally { setPending(false); }
  }
  return <PortalAuthShell title="Im Portal anmelden" hint="Melden Sie sich mit Ihrer Login-ID und Ihrem persönlichen Passwort an.">
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">Login-ID<input autoComplete="username" className={inputClass} disabled={pending} onChange={(event) => setLoginIdentifier(event.target.value)} required value={loginIdentifier} /></label>
      <label className="block text-sm font-medium">Passwort<input autoComplete="current-password" className={inputClass} disabled={pending} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} /></label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">{pending ? "Anmeldung läuft …" : "Anmelden"}</button>
    </form>
    <p className="mt-5 text-center text-sm text-muted-foreground">Noch nicht aktiviert? <Link className="text-primary hover:underline" href="/portal/aktivieren">Zugang aktivieren</Link></p>
  </PortalAuthShell>;
}

export function PortalActivationPage() {
  const router = useRouter();
  const search = useSearchParams();
  const [loginIdentifier, setLoginIdentifier] = React.useState(search.get("login") ?? "");
  const [activationCode, setActivationCode] = React.useState(search.get("code") ?? "");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setError("Die Passwörter stimmen nicht überein."); return; }
    setPending(true); setError("");
    try {
      await portalAuthApi.activatePortal({ loginIdentifier, activationCode, newPassword, confirmPassword });
      router.replace(`/portal/login?login=${encodeURIComponent(loginIdentifier)}`);
    } catch {
      setError("Aktivierung nicht möglich. Bitte prüfen Sie Login-ID, Aktivierungscode und Passwort.");
    } finally { setPending(false); }
  }
  return <PortalAuthShell title="Portalzugang aktivieren" hint="Legen Sie ein persönliches Passwort für Ihren payveo-Portalzugang fest.">
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">Login-ID<input autoComplete="username" className={inputClass} disabled={pending} onChange={(event) => setLoginIdentifier(event.target.value)} required value={loginIdentifier} /></label>
      <label className="block text-sm font-medium">Aktivierungscode<input className={inputClass} disabled={pending} onChange={(event) => setActivationCode(event.target.value)} required value={activationCode} /></label>
      <label className="block text-sm font-medium">Neues Passwort<input autoComplete="new-password" className={inputClass} disabled={pending} minLength={12} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /></label>
      <label className="block text-sm font-medium">Passwort wiederholen<input autoComplete="new-password" className={inputClass} disabled={pending} minLength={12} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} /></label>
      <p className="text-xs text-muted-foreground">Verwenden Sie mindestens 12 Zeichen. Die finalen Anforderungen prüft payveo beim Aktivieren.</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60" disabled={pending} type="submit">{pending ? "Zugang wird aktiviert …" : "Zugang aktivieren"}</button>
    </form>
  </PortalAuthShell>;
}

function PortalAuthShell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold text-primary">payveo Portal</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{hint}</p><div className="mt-6">{children}</div></section></main>;
}
