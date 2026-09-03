"use client";

import { Loader2, Mic, MicOff, Pause, Phone, PhoneOff, Play } from "lucide-react";
import * as React from "react";

import { callStatusLabels, telephonyApi, type AgentPresenceStatus, type StaffTelephonyAccount, type TelephonyCall } from "@/lib/telephony-api";
import { DeskSessionContext } from "./desk-auth-gate";

const presenceLabels: Record<AgentPresenceStatus, string> = { OFFLINE: "Offline", AVAILABLE: "Verfügbar", BUSY: "Beschäftigt", WRAP_UP: "Nachbearbeitung", DO_NOT_DISTURB: "Nicht stören" };

export function SoftphoneBar() {
  const session = React.useContext(DeskSessionContext);
  const canUse = session?.permissions.includes("desk:telephony:use") ?? false;
  const canRead = session?.permissions.includes("desk:telephony:read") ?? false;
  const [accounts, setAccounts] = React.useState<StaffTelephonyAccount[]>([]);
  const [accountId, setAccountId] = React.useState("");
  const [presence, setPresence] = React.useState<AgentPresenceStatus>("OFFLINE");
  const [number, setNumber] = React.useState("");
  const [call, setCall] = React.useState<TelephonyCall | null>(null);
  const [muted, setMuted] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!canRead && !canUse) return;
    void Promise.all([telephonyApi.myTelephony(), telephonyApi.presence()])
      .then(([telephony, currentPresence]) => {
        setAccounts(telephony.accounts);
        setAccountId(telephony.accounts.find((item) => item.isDefault)?.id ?? telephony.accounts[0]?.id ?? "");
        setPresence(currentPresence.status);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Telefonie konnte nicht geladen werden."));
  }, [canRead, canUse]);

  if (!canRead && !canUse) return null;

  async function run(operation: () => Promise<TelephonyCall>) {
    setPending(true);
    setError("");
    try { setCall(await operation()); } catch (cause) { setError(cause instanceof Error ? cause.message : "Telefonieaktion fehlgeschlagen."); } finally { setPending(false); }
  }

  async function changePresence(value: AgentPresenceStatus) {
    setPresence(value);
    try { await telephonyApi.setPresence(value); } catch (cause) { setError(cause instanceof Error ? cause.message : "Status konnte nicht gespeichert werden."); }
  }

  const active = accounts.find((item) => item.id === accountId);
  const connected = call && ["ANSWERED", "HELD"].includes(call.status);
  return <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur lg:left-[260px]">
    <div className="flex flex-wrap items-center gap-2">
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Phone className="size-4" /></span>
      <select aria-label="Telefonstatus" className="h-9 rounded-lg border bg-background px-2 text-xs" disabled={!canUse} onChange={(event) => void changePresence(event.target.value as AgentPresenceStatus)} value={presence}>{Object.entries(presenceLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
      {accounts.length ? <select aria-label="Telefoniekonto" className="h-9 max-w-48 rounded-lg border bg-background px-2 text-xs" disabled={pending || Boolean(call && !["ENDED","FAILED","MISSED","CANCELLED"].includes(call.status))} onChange={(event) => setAccountId(event.target.value)} value={accountId}>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.extension ? ` · ${item.extension}` : ""}</option>)}</select> : <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Telefonie nicht eingerichtet</span>}
      <input aria-label="Telefonnummer" className="h-9 min-w-48 flex-1 rounded-lg border bg-background px-3 text-sm" disabled={!canUse || pending || connected || !active} onChange={(event) => setNumber(event.target.value)} placeholder="Telefonnummer" value={number} />
      {!call || ["ENDED","FAILED","MISSED","CANCELLED"].includes(call.status) ? <><button className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white disabled:opacity-50" disabled={!canUse || pending || !active || !number.trim()} onClick={() => void run(() => telephonyApi.outgoing({ remoteNumber: number, staffTelephonyAccountId: accountId }))} type="button">{pending ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}Anrufen</button>{active?.providerConfig.providerType === "MOCK" ? <button className="h-9 rounded-lg border px-3 text-xs font-medium disabled:opacity-50" disabled={!canUse || pending || !number.trim()} onClick={() => void run(() => telephonyApi.mockIncoming({ remoteNumber: number, staffTelephonyAccountId: accountId }))} type="button">MOCK eingehend</button> : null}</> : <>
        {call.status === "RINGING" && call.direction === "INBOUND" ? <button className="h-9 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white" disabled={pending} onClick={() => void run(() => telephonyApi.action(call.id,"answer"))} type="button">Annehmen</button> : null}
        {call.status === "CREATED" ? <button className="h-9 rounded-lg border px-3 text-xs font-medium" disabled={pending} onClick={() => void run(() => telephonyApi.action(call.id,"ring"))} type="button">Klingeln</button> : null}
        {call.status === "ANSWERED" ? <button aria-label="Halten" className="grid size-9 place-items-center rounded-lg border" disabled={pending} onClick={() => void run(() => telephonyApi.action(call.id,"hold"))} type="button"><Pause className="size-4" /></button> : null}
        {call.status === "HELD" ? <button aria-label="Fortsetzen" className="grid size-9 place-items-center rounded-lg border" disabled={pending} onClick={() => void run(() => telephonyApi.action(call.id,"resume"))} type="button"><Play className="size-4" /></button> : null}
        {connected ? <button aria-label={muted ? "Mikrofon aktivieren" : "Stummschalten"} className="grid size-9 place-items-center rounded-lg border" disabled={pending} onClick={() => { setMuted(!muted); void run(() => telephonyApi.action(call.id, muted ? "unmute" : "mute")); }} type="button">{muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}</button> : null}
        {call.status === "ANSWERED" ? <button className="h-9 rounded-lg border px-2 text-xs" disabled={pending} onClick={() => void run(() => telephonyApi.action(call.id,"dtmf","1"))} title="MOCK sendet die Ziffer 1" type="button">DTMF 1</button> : null}
        {connected ? <button className="h-9 rounded-lg border px-2 text-xs opacity-50" disabled title="Transfer wird erst mit einem Provideradapter aktiviert" type="button">Transfer</button> : null}
        <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-medium text-white" disabled={pending} onClick={() => void run(() => telephonyApi.action(call.id,"end"))} type="button"><PhoneOff className="size-4" />Auflegen</button>
      </>}
      {call ? <span className="text-xs text-muted-foreground">{call.remoteNumber} · {callStatusLabels[call.status]}</span> : null}
    </div>
    {error ? <p className="mt-2 text-xs text-red-700 dark:text-red-300">{error}</p> : null}
  </div>;
}
