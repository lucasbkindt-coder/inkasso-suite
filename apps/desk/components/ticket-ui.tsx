"use client";

import * as React from "react";

import { deskApi, priorityLabels, statusLabels, type DeskCaseOption, type DeskPartyOption, type DeskTicketPriority, type DeskTicketStatus } from "@/lib/desk-api";

export const fieldClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";
export const textareaClass = "min-h-28 w-full resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

export function StatusBadge({ value }: { value: DeskTicketStatus }) { return <span className="inline-flex rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-700 dark:text-sky-300">{statusLabels[value]}</span>; }
export function PriorityBadge({ value }: { value: DeskTicketPriority }) { const tone = value === "URGENT" ? "bg-red-500/10 text-red-700 dark:text-red-300" : value === "HIGH" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"; return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{priorityLabels[value]}</span>; }

export function PartyPicker({ disabled, selected, onSelect }: { disabled?: boolean; selected: DeskPartyOption | null; onSelect(value: DeskPartyOption | null): void }) {
  const [search, setSearch] = React.useState(""); const [results, setResults] = React.useState<DeskPartyOption[]>([]); const [loading, setLoading] = React.useState(false);
  React.useEffect(() => { const value = search.trim(); if (value.length < 2) { setResults([]); return; } const timer = window.setTimeout(() => { setLoading(true); void deskApi.parties(value).then(setResults).finally(() => setLoading(false)); }, 250); return () => window.clearTimeout(timer); }, [search]);
  if (selected) return <SelectedContext label={selected.displayName} onClear={() => onSelect(null)} disabled={disabled} />;
  return <div className="relative"><input className={fieldClass} disabled={disabled} onChange={(event) => setSearch(event.target.value)} placeholder="Mandant oder Schuldner suchen …" value={search} />{loading ? <p className="mt-1 text-xs text-muted-foreground">Suche läuft …</p> : null}{results.length ? <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-card p-1 shadow-xl">{results.map((party) => <button className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted" key={party.id} onClick={() => { onSelect(party); setSearch(""); setResults([]); }} type="button"><span className="font-medium">{party.displayName}</span><span className="ml-2 text-xs text-muted-foreground">{party.roles.map((role) => role.role).join(" · ")}</span></button>)}</div> : null}</div>;
}

export function CasePicker({ disabled, selected, onSelect }: { disabled?: boolean; selected: DeskCaseOption | null; onSelect(value: DeskCaseOption | null): void }) {
  const [search, setSearch] = React.useState(""); const [results, setResults] = React.useState<DeskCaseOption[]>([]); const [loading, setLoading] = React.useState(false);
  React.useEffect(() => { const value = search.trim(); if (value.length < 2) { setResults([]); return; } const timer = window.setTimeout(() => { setLoading(true); void deskApi.cases(value).then(setResults).finally(() => setLoading(false)); }, 250); return () => window.clearTimeout(timer); }, [search]);
  if (selected) { const parties = [selected.clientParty.displayName, selected.debtorParty.displayName].filter(Boolean).join(" / "); return <SelectedContext label={`${selected.caseNumber}${parties ? ` · ${parties}` : ""}`} onClear={() => onSelect(null)} disabled={disabled} />; }
  return <div className="relative"><input className={fieldClass} disabled={disabled} onChange={(event) => setSearch(event.target.value)} placeholder="Aktenzeichen oder Partei suchen …" value={search} />{loading ? <p className="mt-1 text-xs text-muted-foreground">Suche läuft …</p> : null}{results.length ? <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-card p-1 shadow-xl">{results.map((record) => <button className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted" key={record.id} onClick={() => { onSelect(record); setSearch(""); setResults([]); }} type="button"><span className="font-medium">{record.caseNumber}</span><span className="block text-xs text-muted-foreground">{record.clientParty.displayName} · {record.debtorParty.displayName}</span></button>)}</div> : null}</div>;
}

function SelectedContext({ label, disabled, onClear }: { label: string; disabled?: boolean; onClear(): void }) { return <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 text-sm"><span className="font-medium">{label}</span><button className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={disabled} onClick={onClear} type="button">Entfernen</button></div>; }

export function formatDate(value: string) { return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
