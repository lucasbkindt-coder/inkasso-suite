"use client";

import { ArrowDownLeft, ArrowUpRight, Loader2, PhoneMissed } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { callStatusLabels, dispositionLabels, telephonyApi, type TelephonyCall } from "@/lib/telephony-api";
import { deskApi, type DeskOptions } from "@/lib/desk-api";

function date(value: string) { return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function duration(value: number | null) { if (value == null) return "–"; return `${Math.floor(value / 60)}:${String(value % 60).padStart(2,"0")} min`; }

export function CallList() {
  const searchParams = useSearchParams();
  const missed = searchParams.get("missed") === "true";
  const [items, setItems] = React.useState<TelephonyCall[]>([]);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [direction, setDirection] = React.useState("");
  const [agent, setAgent] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [options, setOptions] = React.useState<DeskOptions>({ memberships: [], teams: [] });
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (missed) params.set("missed","true");
      if (search.trim()) params.set("search",search.trim());
      if (status) params.set("status",status);
      if (direction) params.set("direction",direction);
      if (agent) params.set("agentMembershipId",agent);
      if (from) params.set("from",new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set("to",new Date(`${to}T23:59:59.999`).toISOString());
      params.set("page",String(page));
      setLoading(true); setError("");
      void telephonyApi.calls(params).then((value) => { setItems(value.items); setTotalPages(Math.max(1,value.totalPages)); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Anrufe konnten nicht geladen werden.")).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [agent, direction, from, missed, page, search, status, to]);
  React.useEffect(() => { void deskApi.options().then(setOptions).catch(() => undefined); }, []);
  return <section className="space-y-6 pb-24">
    <header><p className="text-sm font-medium text-primary">Telefonie</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{missed ? "Verpasste Anrufe" : "Anrufe"}</h1><p className="mt-2 text-sm text-muted-foreground">Tenantgebundene Telefonhistorie aus der zentralen Kommunikation.</p></header>
    <div className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6"><input className="h-10 rounded-lg border bg-background px-3 text-sm xl:col-span-2" onChange={(e)=>setSearch(e.target.value)} placeholder="Nummer, Partei oder Akte suchen" value={search}/><select className="h-10 rounded-lg border bg-background px-3 text-sm" onChange={(e)=>setDirection(e.target.value)} value={direction}><option value="">Alle Richtungen</option><option value="INBOUND">Eingehend</option><option value="OUTBOUND">Ausgehend</option></select><select className="h-10 rounded-lg border bg-background px-3 text-sm" onChange={(e)=>setStatus(e.target.value)} value={status}><option value="">Alle Status</option>{Object.entries(callStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><select className="h-10 rounded-lg border bg-background px-3 text-sm" onChange={(e)=>setAgent(e.target.value)} value={agent}><option value="">Alle Agenten</option>{options.memberships.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select><span className="grid grid-cols-2 gap-2"><input aria-label="Von" className="h-10 min-w-0 rounded-lg border bg-background px-2 text-xs" onChange={(e)=>setFrom(e.target.value)} type="date" value={from}/><input aria-label="Bis" className="h-10 min-w-0 rounded-lg border bg-background px-2 text-xs" onChange={(e)=>setTo(e.target.value)} type="date" value={to}/></span></div>
    {error ? <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr>{["Zeit","Richtung","Nummer","Partei","Akte","Ticket","Agent","Status","Dauer","Ergebnis"].map((value)=><th className="px-4 py-3 font-medium" key={value}>{value}</th>)}</tr></thead><tbody>{items.map((call)=><tr className="border-t hover:bg-muted/30" key={call.id}><td className="px-4 py-3"><Link className="font-medium text-primary hover:underline" href={`/calls/${call.id}`}>{date(call.startedAt)}</Link></td><td className="px-4 py-3">{call.direction === "INBOUND" ? <ArrowDownLeft className="size-4 text-sky-600"/> : <ArrowUpRight className="size-4 text-emerald-600"/>}</td><td className="px-4 py-3 font-mono">{call.remoteNumber}</td><td className="px-4 py-3">{call.party?.displayName ?? (call.matchStatus === "REVIEW_REQUIRED" ? "Prüfung erforderlich" : "Unbekannt")}</td><td className="px-4 py-3">{call.case?.caseNumber ?? "–"}</td><td className="px-4 py-3">{call.ticket?.number ?? "–"}</td><td className="px-4 py-3">{call.agentMembership?.user.displayName ?? call.agentMembership?.user.email ?? "–"}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs ${call.status === "MISSED" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-muted"}`}>{callStatusLabels[call.status]}</span></td><td className="px-4 py-3">{duration(call.durationSeconds)}</td><td className="px-4 py-3">{call.disposition ? dispositionLabels[call.disposition] : "–"}</td></tr>)}</tbody></table></div>{loading ? <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin"/>Anrufe werden geladen …</p> : !items.length ? <p className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><PhoneMissed className="size-4"/>Keine passenden Anrufe.</p> : null}<div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground"><span>Seite {page} von {totalPages}</span><span className="flex gap-2"><button className="rounded border px-3 py-1.5 disabled:opacity-50" disabled={page<=1} onClick={()=>setPage((value)=>value-1)} type="button">Zurück</button><button className="rounded border px-3 py-1.5 disabled:opacity-50" disabled={page>=totalPages} onClick={()=>setPage((value)=>value+1)} type="button">Weiter</button></span></div></div>
  </section>;
}
