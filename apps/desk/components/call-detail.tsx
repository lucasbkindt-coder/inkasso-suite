"use client";

import { ArrowLeft, Loader2, PhoneCall } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { deskApi, type DeskCaseOption, type DeskPartyOption } from "@/lib/desk-api";
import { callStatusLabels, dispositionLabels, telephonyApi, type CallDisposition, type TelephonyCall } from "@/lib/telephony-api";
import { CasePicker, PartyPicker, fieldClass, textareaClass } from "./ticket-ui";

export function CallDetail() {
  const { id } = useParams<{ id: string }>();
  const [call, setCall] = React.useState<TelephonyCall | null>(null);
  const [note, setNote] = React.useState("");
  const [disposition, setDisposition] = React.useState<CallDisposition | "">("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [tickets, setTickets] = React.useState<Array<{ id: string; number: string; subject: string }>>([]);
  const load = React.useCallback(() => telephonyApi.call(id).then((value) => { setCall(value); setNote(value.wrapUpNote ?? ""); setDisposition(value.disposition ?? ""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Anruf konnte nicht geladen werden.")), [id]);
  React.useEffect(() => {
    void load();
    void deskApi.tickets(new URLSearchParams({ pageSize: "100" })).then((value) => setTickets(value.items.map((item) => ({ id: item.id, number: item.number, subject: item.subject })))).catch(() => setTickets([]));
  }, [load]);
  async function update(payload: Parameters<typeof telephonyApi.updateCall>[1], message: string) { setPending(true); setError(""); setSuccess(""); try { await telephonyApi.updateCall(id,payload); await load(); setSuccess(message); } catch(cause) { setError(cause instanceof Error ? cause.message : "Anruf konnte nicht aktualisiert werden."); } finally { setPending(false); } }
  if (!call) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Anruf wird geladen …</p>;
  const selectedParty: DeskPartyOption | null = call.party ? { id: call.party.id, displayName: call.party.displayName, type: "PERSON", roles: [] } : null;
  const selectedCase: DeskCaseOption | null = call.case ? { id: call.case.id, caseNumber: call.case.caseNumber, clientParty: { id:"",displayName:"" }, debtorParty: { id:"",displayName:"" } } : null;
  return <section className="space-y-6 pb-24"><Link className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" href="/calls"><ArrowLeft className="size-4"/>Anrufe</Link>
    <header className="rounded-2xl border bg-card p-6 shadow-sm"><div className="flex items-start gap-4"><span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><PhoneCall className="size-5"/></span><div><p className="font-mono text-sm text-primary">{call.remoteNumber}</p><h1 className="mt-1 text-2xl font-semibold">{call.direction === "INBOUND" ? "Eingehender" : "Ausgehender"} Anruf</h1><p className="mt-2 text-sm text-muted-foreground">{callStatusLabels[call.status]} · {new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short"}).format(new Date(call.startedAt))} · {call.durationSeconds ?? 0} Sekunden</p></div></div></header>
    {error ? <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}{success ? <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{success}</p> : null}
    <div className="grid gap-6 xl:grid-cols-2"><article className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Zuordnung</h2><label className="grid gap-2 text-sm font-medium">Partei<PartyPicker disabled={pending} onSelect={(value)=>void update({partyId:value?.id ?? null},"Partei wurde zugeordnet.")} selected={selectedParty}/></label><label className="grid gap-2 text-sm font-medium">Inkassoakte<CasePicker disabled={pending} onSelect={(value)=>void update({caseId:value?.id ?? null},"Akte wurde zugeordnet.")} selected={selectedCase}/></label><label className="grid gap-2 text-sm font-medium">Ticket<select className={fieldClass} disabled={pending} onChange={(event)=>void update({ticketId:event.target.value||null},"Ticket wurde zugeordnet.")} value={call.ticket?.id??""}><option value="">Nicht zugeordnet</option>{tickets.map((ticket)=><option key={ticket.id} value={ticket.id}>{ticket.number} · {ticket.subject}</option>)}</select></label>{!call.ticket?<Link className="inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium hover:bg-muted" href="/tickets/new">Neues Ticket anlegen</Link>:null}<div className="rounded-xl bg-muted/50 p-3 text-sm"><p>Agent: {call.agentMembership?.user.displayName ?? call.agentMembership?.user.email ?? "–"}</p><p className="mt-1">Telefoniekonto: {call.staffTelephonyAccount?.name ?? "–"}{call.staffTelephonyAccount?.extension ? ` · ${call.staffTelephonyAccount.extension}` : ""}</p></div></article>
      <article className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Nachbearbeitung</h2><label className="grid gap-2 text-sm font-medium">Gesprächsergebnis<select className={fieldClass} onChange={(e)=>setDisposition(e.target.value as CallDisposition | "")} value={disposition}><option value="">Nicht festgelegt</option>{Object.entries(dispositionLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-2 text-sm font-medium">Interne Gesprächsnotiz<textarea className={textareaClass} maxLength={2000} onChange={(e)=>setNote(e.target.value)} value={note}/></label><div className="flex flex-wrap gap-2"><button className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={pending} onClick={()=>void update({ disposition: disposition || undefined, wrapUpNote: note.trim() },"Nachbearbeitung wurde gespeichert.")} type="button">Speichern</button>{disposition === "CALLBACK_REQUESTED" && call.case ? <button className="h-10 rounded-lg border px-4 text-sm font-medium disabled:opacity-50" disabled={pending} onClick={async()=>{setPending(true);setError("");try{await telephonyApi.callbackTask(call.id,{});setSuccess("Rückruf-Aufgabe wurde erstellt.");}catch(cause){setError(cause instanceof Error ? cause.message : "Rückruf-Aufgabe konnte nicht erstellt werden.");}finally{setPending(false);}}} type="button">Rückruf-Aufgabe erstellen</button>:null}</div></article></div>
    {call.screenPop?.parties.length ? <article className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="font-semibold">Anrufer-Kontext</h2><div className="mt-4 grid gap-3">{call.screenPop.parties.map((party)=><div className="rounded-xl border p-4" key={party.id}><p className="font-medium">{party.displayName}</p><p className="mt-1 text-xs text-muted-foreground">{party.clientCases.length + party.debtorCases.length} offene Akten · {party.deskTickets.length} offene Tickets · {party.communications.length} letzte Kontakte</p></div>)}</div></article>:null}
  </section>;
}
