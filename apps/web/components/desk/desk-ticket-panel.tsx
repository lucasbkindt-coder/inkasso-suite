"use client";

import { ExternalLink, Headphones, Plus } from "lucide-react";
import * as React from "react";

import { staffAuthApi } from "@/lib/staff-auth-api";

type DeskTicket = { id: string; number: string; subject: string; status: "OPEN" | "PENDING" | "WAITING" | "RESOLVED" | "CLOSED"; priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"; updatedAt: string };
type DeskTicketList = { items: DeskTicket[]; total: number };
type ApiError = { message?: string | string[] };

const statusLabels: Record<DeskTicket["status"], string> = { OPEN: "Offen", PENDING: "In Bearbeitung", WAITING: "Wartend", RESOLVED: "Gelöst", CLOSED: "Geschlossen" };

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/api/desk${path}`, { cache: "no-store", credentials: "include" });
  if (response.ok) return response.json() as Promise<T>;
  const body = await response.json().catch(() => ({})) as ApiError;
  throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message || "Desk-Daten konnten nicht geladen werden.");
}

export function DeskTicketPanel({ partyId, caseId }: { partyId?: string; caseId?: string }) {
  const [tickets, setTickets] = React.useState<DeskTicketList | null>(null); const [baseUrl, setBaseUrl] = React.useState(""); const [visible, setVisible] = React.useState(false); const [error, setError] = React.useState("");
  React.useEffect(() => { let active = true; void staffAuthApi.session().then(async (session) => { if (!session.permissions.includes("desk:read")) return; if (active) setVisible(true); const params = new URLSearchParams({ pageSize: "5", ...(partyId ? { partyId } : {}), ...(caseId ? { caseId } : {}) }); const [list, config] = await Promise.all([request<DeskTicketList>(`/tickets?${params.toString()}`), request<{ publicBaseUrl: string }>("/config")]); if (active) { setTickets(list); setBaseUrl(config.publicBaseUrl.replace(/\/$/, "")); } }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Desk-Daten konnten nicht geladen werden."); }); return () => { active = false; }; }, [partyId, caseId]);
  if (!visible) return null;
  const contextQuery = new URLSearchParams({ ...(partyId ? { partyId } : {}), ...(caseId ? { caseId } : {}) });
  return <section className="rounded-xl border bg-card p-6 shadow-sm"><header className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Headphones className="size-5" /></span><div><h3 className="font-semibold">Desk / Tickets</h3><p className="text-sm text-muted-foreground">Verknüpfte interne Kommunikationsvorgänge</p></div></div>{baseUrl ? <a className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" href={`${baseUrl}/tickets/new?${contextQuery.toString()}`} rel="noopener noreferrer" target="_blank"><Plus className="size-4" />Ticket erstellen</a> : null}</header>{error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}{!tickets && !error ? <p className="mt-5 text-sm text-muted-foreground">Tickets werden geladen …</p> : null}<div className="mt-5 divide-y">{tickets?.items.map((ticket) => <a className="flex items-center justify-between gap-4 py-3 text-sm hover:text-primary" href={`${baseUrl}/tickets/${ticket.id}`} key={ticket.id} rel="noopener noreferrer" target="_blank"><div className="min-w-0"><p className="font-medium">{ticket.number} · {ticket.subject}</p><p className="mt-1 text-xs text-muted-foreground">{statusLabels[ticket.status]} · aktualisiert {new Intl.DateTimeFormat("de-DE").format(new Date(ticket.updatedAt))}</p></div><ExternalLink className="size-4 shrink-0 text-muted-foreground" /></a>)}{tickets && !tickets.items.length ? <p className="py-4 text-sm text-muted-foreground">Noch keine verknüpften Tickets.</p> : null}</div>{tickets && tickets.total > tickets.items.length && baseUrl ? <a className="mt-3 inline-flex text-sm font-medium text-primary hover:underline" href={`${baseUrl}/tickets?${contextQuery.toString()}`} rel="noopener noreferrer" target="_blank">Alle {tickets.total} Tickets öffnen</a> : null}</section>;
}
