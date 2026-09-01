"use client";

import { CheckCircle2, Clock3, Inbox, Loader2, UserRoundCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { deskApi, type DeskDashboard } from "@/lib/desk-api";

const cards = [
  { key: "mine", label: "Meine offenen Tickets", icon: UserRoundCheck, href: "/tickets?mine=true" },
  { key: "unassigned", label: "Nicht zugewiesen", icon: Inbox, href: "/tickets?unassigned=true" },
  { key: "open", label: "Offen gesamt", icon: UsersRound, href: "/tickets" },
  { key: "waiting", label: "Wartend", icon: Clock3, href: "/tickets?status=WAITING" },
  { key: "completedToday", label: "Heute erledigt", icon: CheckCircle2, href: "/tickets?status=RESOLVED" },
] as const;

export function DeskDashboardView() {
  const [data, setData] = React.useState<DeskDashboard | null>(null); const [error, setError] = React.useState("");
  React.useEffect(() => { void deskApi.dashboard().then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : "Kennzahlen konnten nicht geladen werden.")); }, []);
  return <section className="space-y-6"><header><p className="text-sm font-medium text-primary">Desk · Übersicht</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Kommunikation im Blick</h1><p className="mt-2 text-sm text-muted-foreground">Echte Ticketbestände des aktiven Mandanten.</p></header>{error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}{!data && !error ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Kennzahlen werden geladen …</p> : null}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{data ? cards.map(({ key, label, icon: Icon, href }) => <Link className="rounded-2xl border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" href={href} key={key}><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><p className="mt-5 text-3xl font-semibold tabular-nums">{data[key]}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></Link>) : null}</div></section>;
}
