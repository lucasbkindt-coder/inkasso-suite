"use client";

import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ClipboardList, Euro, FolderKanban, Loader2, Plus, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { caseApi } from "@/components/cases/case-api";
import { casePhaseLabels, casePriorityLabels, formatCurrency, formatDate, priorityBadgeClasses } from "@/components/cases/case-ui";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { formatTaskDeadline, taskLabels, taskPriorityClasses } from "@/components/tasks/task-ui";
import { Button } from "@/components/ui/button";
import type { DashboardSummary, DashboardTask } from "@/types/dashboard";

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>;
}

function SectionHeader({ title, description, href, linkLabel }: { title: string; description: string; href?: string; linkLabel?: string }) {
  return <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{href && linkLabel ? <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={href}>{linkLabel}<ArrowRight className="size-4" /></Link> : null}</div>;
}

function TaskItems({ items, empty }: { items: DashboardTask[]; empty: string }) {
  if (!items.length) return <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>;
  return <div className="space-y-2">{items.map((task) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" key={task.id}><div className="min-w-0"><p className="truncate text-sm font-medium">{task.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{taskLabels[task.type]}</span>{task.case ? <Link className="font-medium text-primary hover:underline" href={`/akten/${task.case.id}`}>{task.case.caseNumber}</Link> : <span>Ohne Akte</span>}</div></div><div className="flex items-center gap-2"><Badge className={taskPriorityClasses[task.priority]}>{taskLabels[task.priority]}</Badge><span className="whitespace-nowrap text-xs text-muted-foreground">{formatTaskDeadline({ ...task, status: "OPEN", caseId: task.case?.id ?? null, description: null, assignedMembershipId: null, completedAt: null, cancelledAt: null, createdAt: "", updatedAt: "" })}</span></div></article>)}</div>;
}

export function DashboardLayout() {
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await caseApi.getDashboardSummary());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Die Arbeitsübersicht konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const kpis = summary ? [
    ["Aktive Inkassoakten", String(summary.kpis.activeCases), BriefcaseBusiness, "text-primary"],
    ["Offener Forderungsbestand", formatCurrency(summary.ledger.totalOpen, "EUR"), Euro, "text-emerald-700 dark:text-emerald-300"],
    ["Überfällige Aufgaben", String(summary.kpis.overdueTasks), AlertTriangle, "text-destructive"],
    ["Heute fällige Aufgaben", String(summary.kpis.todayTasks), CalendarClock, "text-amber-700 dark:text-amber-300"],
  ] as const : [];

  return <div className="space-y-6 sm:space-y-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p><h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Übersicht</h2><p className="mt-2 text-sm text-muted-foreground">Operativer Überblick über Akten, Forderungen und anstehende Arbeit.</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => setTaskDialogOpen(true)} variant="outline"><Plus className="size-4" /> Aufgabe erstellen</Button><Link href="/akten"><Button><FolderKanban className="size-4" /> Neue Inkassoakte</Button></Link></div></header>

    <TaskDialog onOpenChange={setTaskDialogOpen} onSaved={() => void load()} open={taskDialogOpen} />

    {loading ? <div className="flex min-h-48 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Arbeitsübersicht wird geladen …</div> : null}
    {!loading && error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive"><p>{error}</p><Button className="mt-3" onClick={() => void load()} variant="outline">Erneut versuchen</Button></div> : null}
    {!loading && !error && summary ? <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([title, value, Icon, color]) => <article className="rounded-xl border bg-card p-5 shadow-sm" key={title}><div className="flex items-start justify-between gap-3"><div><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div><div className="rounded-xl bg-muted p-3"><Icon className={`size-5 ${color}`} /></div></div></article>)}</section>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"><section className="rounded-xl border bg-card p-5 shadow-sm"><SectionHeader description="Überfällige Aufgaben, heutige Termine und nächste Wiedervorlagen." href="/aufgaben" linkLabel="Alle Aufgaben anzeigen" title="Aufgaben & Fristen" /><div className="grid gap-5 lg:grid-cols-3"><div><h3 className="mb-3 text-sm font-medium text-destructive">Überfällig</h3><TaskItems empty="Keine überfälligen Aufgaben." items={summary.tasks.overdue} /></div><div><h3 className="mb-3 text-sm font-medium text-amber-700 dark:text-amber-300">Heute</h3><TaskItems empty="Für heute sind keine Aufgaben fällig." items={summary.tasks.today} /></div><div><h3 className="mb-3 text-sm font-medium">Nächste Wiedervorlagen</h3><TaskItems empty="Keine kommenden Wiedervorlagen." items={summary.tasks.upcoming} /></div></div></section>
        <section className="rounded-xl border bg-card p-5 shadow-sm"><SectionHeader description="Aktuelle offene Werte aus dem Forderungskonto." title="Forderungsbestand" /><dl className="space-y-3 text-sm"><Amount label="Hauptforderung offen" value={summary.ledger.openPrincipal} /><Amount label="Kosten offen" value={summary.ledger.openCosts} /><Amount label="Zinsen offen" value={summary.ledger.openInterest} /><div className="border-t pt-3"><Amount bold label="Gesamt offen" value={summary.ledger.totalOpen} /></div><div className="rounded-lg bg-muted/60 p-3"><Amount label="Nicht zugeordnetes Guthaben" value={summary.ledger.unallocatedPayments} /></div></dl></section></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"><section className="rounded-xl border bg-card p-5 shadow-sm"><SectionHeader description="Priorisierte, aktive Inkassoakten mit aktueller Bearbeitung." href="/akten" linkLabel="Inkassoakten öffnen" title="Akten mit Handlungsbedarf" />{summary.attentionCases.length ? <div className="overflow-x-auto"><table className="min-w-[700px] w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Aktenzeichen", "Schuldner", "Auftraggeber", "Phase", "Priorität", "Aktualisiert"].map((label) => <th className="px-3 py-2.5 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{summary.attentionCases.map((item) => <tr className="border-b last:border-0 hover:bg-muted/30" key={item.id}><td className="px-3 py-3 font-medium"><Link className="text-primary hover:underline" href={`/akten/${item.id}`}>{item.caseNumber}</Link></td><td className="px-3 py-3">{item.debtorParty.displayName}</td><td className="px-3 py-3">{item.clientParty.displayName}</td><td className="px-3 py-3">{casePhaseLabels[item.phase]}</td><td className="px-3 py-3"><Badge className={priorityBadgeClasses[item.priority]}>{casePriorityLabels[item.priority]}</Badge></td><td className="px-3 py-3 whitespace-nowrap">{formatDate(item.updatedAt)}</td></tr>)}</tbody></table></div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Keine aktiven Inkassoakten vorhanden.</p>}</section>
        <section className="rounded-xl border bg-card p-5 shadow-sm"><SectionHeader description="Zuletzt erfasste Zahlungseingänge." title="Letzte Zahlungen" />{summary.recentPayments.length ? <div className="space-y-3">{summary.recentPayments.map((payment) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" key={payment.id}><div><Link className="text-sm font-medium text-primary hover:underline" href={`/akten/${payment.caseId}`}>{payment.caseNumber}</Link><p className="mt-1 text-xs text-muted-foreground">{payment.debtorName} · {formatDate(payment.bookingDate)}</p><p className="mt-1 text-xs text-muted-foreground">{payment.unallocatedAmount === "0.00" ? "Vollständig zugeordnet" : `Nicht zugeordnet: ${formatCurrency(payment.unallocatedAmount, payment.currency)}`}</p></div><p className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(payment.amount, payment.currency)}</p></article>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Keine aktuellen Zahlungen vorhanden.</p>}</section></div>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Link className="rounded-xl border bg-card p-4 shadow-sm transition hover:bg-muted/40" href="/akten"><FolderKanban className="size-5 text-primary" /><p className="mt-3 font-medium">Neue Inkassoakte</p><p className="mt-1 text-sm text-muted-foreground">Aktenverwaltung öffnen</p></Link><button className="rounded-xl border bg-card p-4 text-left shadow-sm transition hover:bg-muted/40" onClick={() => setTaskDialogOpen(true)} type="button"><ClipboardList className="size-5 text-primary" /><p className="mt-3 font-medium">Aufgabe erstellen</p><p className="mt-1 text-sm text-muted-foreground">Neue Aufgabe oder Frist anlegen</p></button><Link className="rounded-xl border bg-card p-4 shadow-sm transition hover:bg-muted/40" href="/akten"><BriefcaseBusiness className="size-5 text-primary" /><p className="mt-3 font-medium">Inkassoakten öffnen</p><p className="mt-1 text-sm text-muted-foreground">Aktive Akten bearbeiten</p></Link><Link className="rounded-xl border bg-card p-4 shadow-sm transition hover:bg-muted/40" href="/aufgaben"><CheckCircle2 className="size-5 text-primary" /><p className="mt-3 font-medium">Aufgaben &amp; Fristen öffnen</p><p className="mt-1 text-sm text-muted-foreground">Zentrale Aufgabenliste öffnen</p></Link></section>
    </> : null}
  </div>;
}

function Amount({ bold = false, label, value }: { bold?: boolean; label: string; value: string }) {
  return <div className={`flex items-center justify-between gap-4 ${bold ? "font-semibold" : ""}`}><dt className="text-muted-foreground">{label}</dt><dd className="whitespace-nowrap">{formatCurrency(value, "EUR")}</dd></div>;
}
