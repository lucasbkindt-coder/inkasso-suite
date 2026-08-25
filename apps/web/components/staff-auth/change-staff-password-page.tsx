"use client";

import { Loader2, Scale } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";

export function ChangeStaffPasswordPage() {
  const router = useRouter(); const [currentPassword, setCurrentPassword] = React.useState(""); const [newPassword, setNewPassword] = React.useState(""); const [pending, setPending] = React.useState(false); const [error, setError] = React.useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setPending(true); setError(""); try { await staffAuthApi.changePassword({ currentPassword, newPassword }); router.replace("/"); router.refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Passwort konnte nicht geändert werden."); } finally { setPending(false); } }
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-4"><form className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-7 shadow-sm" onSubmit={submit}><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Scale className="size-5" /></div><div><p className="font-semibold">payveo</p><p className="text-sm text-muted-foreground">Passwort ändern</p></div></div><h1 className="pt-4 text-xl font-semibold">Temporäres Passwort ersetzen</h1><p className="text-sm text-muted-foreground">Bevor Sie weiterarbeiten, legen Sie bitte ein eigenes Passwort fest.</p><label className="grid gap-1 text-sm font-medium">Aktuelles Passwort<input className="h-10 rounded-lg border bg-background px-3 font-normal" onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} /></label><label className="grid gap-1 text-sm font-medium">Neues Passwort<input className="h-10 rounded-lg border bg-background px-3 font-normal" minLength={12} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} /></label>{error ? <p className="text-sm text-destructive">{error}</p> : null}<Button className="w-full" disabled={pending} type="submit">{pending ? <><Loader2 className="size-4 animate-spin" /> Wird gespeichert …</> : "Passwort speichern"}</Button></form></main>;
}
