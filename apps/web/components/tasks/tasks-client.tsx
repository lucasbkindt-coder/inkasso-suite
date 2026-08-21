"use client";

import { Check, ChevronLeft, ChevronRight, ClipboardList, Loader2, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { caseApi } from "@/components/cases/case-api";
import { Button } from "@/components/ui/button";
import type { CaseTask, TaskPriority, TaskStatus, TaskType, TasksResponse } from "@/types/task";
import { TaskDialog } from "./task-dialog";
import { formatTaskDeadline, isTaskOpen, taskLabels, taskPriorityClasses, taskSortValue, taskStatusClasses } from "./task-ui";

type QuickFilter = "OPEN" | "OVERDUE" | "TODAY" | "UPCOMING" | "COMPLETED";

const quickFilters: { value: QuickFilter; label: string }[] = [
  { value: "OPEN", label: "Alle offenen" },
  { value: "OVERDUE", label: "Überfällig" },
  { value: "TODAY", label: "Heute" },
  { value: "UPCOMING", label: "Kommend" },
  { value: "COMPLETED", label: "Erledigt" },
];

const selectClass = "h-10 rounded-lg border bg-background px-3 text-sm";
const pageSize = 20;

function isToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function isUpcoming(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = start + 7 * 86_400_000;
  const timestamp = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return timestamp > start && timestamp < end;
}

function isOverdue(task: CaseTask) {
  const value = task.dueAt ?? task.followUpAt;
  if (!value || !isTaskOpen(task)) return false;
  const date = new Date(value);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return date.getTime() < start;
}

function matchesQuickFilter(task: CaseTask, filter: QuickFilter) {
  const value = task.dueAt ?? task.followUpAt;
  if (filter === "OPEN") return isTaskOpen(task);
  if (filter === "OVERDUE") return isOverdue(task);
  if (filter === "TODAY") return isTaskOpen(task) && isToday(value);
  if (filter === "UPCOMING") return isTaskOpen(task) && isUpcoming(value);
  return task.status === "COMPLETED";
}

function sortTasks(tasks: CaseTask[]) {
  return [...tasks].sort((left, right) => {
    const leftValues = taskSortValue(left);
    const rightValues = taskSortValue(right);
    for (let index = 0; index < leftValues.length; index += 1) {
      if (leftValues[index] !== rightValues[index]) return leftValues[index] - rightValues[index];
    }
    return 0;
  });
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>;
}

export function TasksClient() {
  const [result, setResult] = React.useState<TasksResponse | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>("OPEN");
  const [type, setType] = React.useState<TaskType | "">("");
  const [priority, setPriority] = React.useState<TaskPriority | "">("");
  const [status, setStatus] = React.useState<TaskStatus | "">("");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dialogTask, setDialogTask] = React.useState<CaseTask | null | undefined>(undefined);
  const [actionId, setActionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await caseApi.getTasks({ pageSize: 100, search, type: type || undefined, priority: priority || undefined, status: status || undefined });
      setResult(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aufgaben konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [priority, search, status, type]);

  React.useEffect(() => { void load(); }, [load]);

  const filteredItems = React.useMemo(() => {
    const items = result?.items.filter((item) => matchesQuickFilter(item, quickFilter)) ?? [];
    return sortTasks(items);
  }, [quickFilter, result]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const kpis = React.useMemo(() => ({
    overdue: result?.items.filter(isOverdue).length ?? 0,
    today: result?.items.filter((item) => isTaskOpen(item) && isToday(item.dueAt ?? item.followUpAt)).length ?? 0,
    upcoming: result?.items.filter((item) => isTaskOpen(item) && isUpcoming(item.dueAt ?? item.followUpAt)).length ?? 0,
    open: result?.items.filter(isTaskOpen).length ?? 0,
  }), [result]);

  React.useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const transition = async (task: CaseTask, action: "complete" | "cancel" | "reopen") => {
    setActionId(task.id);
    setError("");
    try {
      if (action === "complete") await caseApi.completeTask(task.id);
      else if (action === "cancel") await caseApi.cancelTask(task.id);
      else await caseApi.reopenTask(task.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status konnte nicht geändert werden.");
    } finally {
      setActionId(null);
    }
  };

  const emptyMessage = quickFilter === "OVERDUE" ? "Keine überfälligen Fristen." : quickFilter === "TODAY" ? "Keine Aufgaben für heute." : quickFilter === "OPEN" ? "Keine offenen Aufgaben." : "Keine Aufgaben entsprechen den aktuellen Filtern.";

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Aufgaben &amp; Fristen</h1>
          <p className="mt-2 text-sm text-muted-foreground">Offene Aufgaben, Fristen und Wiedervorlagen zentral bearbeiten.</p>
        </div>
        <Button onClick={() => setDialogTask(null)}><Plus className="size-4" /> Aufgabe erstellen</Button>
      </div>

      <TaskDialog onOpenChange={(open) => !open && setDialogTask(undefined)} onSaved={() => void load()} open={dialogTask !== undefined} task={dialogTask} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Überfällig", kpis.overdue, "text-destructive"],
          ["Heute", kpis.today, "text-amber-700 dark:text-amber-300"],
          ["Kommend", kpis.upcoming, "text-primary"],
          ["Offen gesamt", kpis.open, "text-foreground"],
        ].map(([label, value, color]) => <article className="rounded-xl border bg-card p-4 shadow-sm" key={label as string}><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold ${color as string}`}>{loading ? "—" : value}</p></article>)}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-wrap gap-2">
            {quickFilters.map((filter) => <Button key={filter.value} onClick={() => { setQuickFilter(filter.value); setPage(1); }} variant={quickFilter === filter.value ? "default" : "outline"}>{filter.label}</Button>)}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,auto)]">
            <div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm" onChange={(event) => setSearchInput(event.target.value)} placeholder="Aufgaben suchen" value={searchInput} /></div>
            <select className={selectClass} onChange={(event) => { setType(event.target.value as TaskType | ""); setPage(1); }} value={type}><option value="">Alle Typen</option>{(["TASK", "DEADLINE", "FOLLOW_UP"] as TaskType[]).map((value) => <option key={value} value={value}>{taskLabels[value]}</option>)}</select>
            <select className={selectClass} onChange={(event) => { setPriority(event.target.value as TaskPriority | ""); setPage(1); }} value={priority}><option value="">Alle Prioritäten</option>{(["LOW", "NORMAL", "HIGH", "URGENT"] as TaskPriority[]).map((value) => <option key={value} value={value}>{taskLabels[value]}</option>)}</select>
            <select className={selectClass} onChange={(event) => { setStatus(event.target.value as TaskStatus | ""); setPage(1); }} value={status}><option value="">Alle Status</option>{(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as TaskStatus[]).map((value) => <option key={value} value={value}>{taskLabels[value]}</option>)}</select>
          </div>
        </div>

        {loading ? <p className="p-8 text-sm text-muted-foreground">Aufgaben werden geladen …</p> : null}
        {!loading && error ? <p className="p-8 text-sm text-destructive">{error}</p> : null}
        {!loading && !error && visibleItems.length === 0 ? <p className="p-8 text-sm text-muted-foreground">{emptyMessage}</p> : null}
        {!loading && !error && visibleItems.length > 0 ? <>
          <div className="hidden overflow-x-auto md:block"><table className="min-w-[1000px] w-full text-left text-sm"><thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Titel", "Typ", "Akte", "Priorität", "Status", "Fälligkeit", "Sachbearbeiter", "Aktionen"].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{visibleItems.map((task) => <TaskRow actionId={actionId} key={task.id} onAction={transition} onEdit={setDialogTask} task={task} />)}</tbody></table></div>
          <div className="space-y-3 p-4 md:hidden">{visibleItems.map((task) => <TaskCard actionId={actionId} key={task.id} onAction={transition} onEdit={setDialogTask} task={task} />)}</div>
          <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground"><span>{filteredItems.length} Aufgabe{filteredItems.length === 1 ? "" : "n"}</span><div className="flex items-center gap-2"><Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} size="icon" variant="outline"><ChevronLeft className="size-4" /></Button><span>Seite {page} von {totalPages}</span><Button disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)} size="icon" variant="outline"><ChevronRight className="size-4" /></Button></div></div>
        </> : null}
      </div>
    </section>
  );
}

type TaskActionProps = { task: CaseTask; actionId: string | null; onAction: (task: CaseTask, action: "complete" | "cancel" | "reopen") => Promise<void>; onEdit: (task: CaseTask) => void };

function TaskActions({ actionId, onAction, onEdit, task }: TaskActionProps) {
  const busy = actionId === task.id;
  if (!isTaskOpen(task)) return <Button disabled={busy} onClick={() => void onAction(task, "reopen")} variant="outline"><RotateCcw className="size-4" /> Wieder öffnen</Button>;
  return <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void onAction(task, "complete")} variant="outline">{busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-emerald-600" />} Erledigen</Button><Button disabled={busy} onClick={() => onEdit(task)} variant="outline"><Pencil className="size-4" /> Bearbeiten</Button><Button disabled={busy} onClick={() => void onAction(task, "cancel")} variant="ghost"><X className="size-4 text-destructive" /> Abbrechen</Button></div>;
}

function TaskRow(props: TaskActionProps) {
  const { task } = props;
  return <tr className="border-b last:border-0 hover:bg-muted/30"><td className="px-4 py-4"><p className="font-medium">{task.title}</p>{task.description ? <p className="mt-1 max-w-64 truncate text-xs text-muted-foreground">{task.description}</p> : null}</td><td className="px-4 py-4">{taskLabels[task.type]}</td><td className="px-4 py-4">{task.case ? <Link className="font-medium text-primary hover:underline" href={`/akten/${task.case.id}`}>{task.case.caseNumber}</Link> : "Nicht zugeordnet"}</td><td className="px-4 py-4"><Badge className={taskPriorityClasses[task.priority]}>{taskLabels[task.priority]}</Badge></td><td className="px-4 py-4"><Badge className={taskStatusClasses[task.status]}>{taskLabels[task.status]}</Badge></td><td className="px-4 py-4 whitespace-nowrap">{formatTaskDeadline(task)}</td><td className="px-4 py-4">{task.assignedMembership?.user.displayName ?? task.assignedMembership?.user.email ?? "Nicht zugewiesen"}</td><td className="px-4 py-4"><TaskActions {...props} /></td></tr>;
}

function TaskCard(props: TaskActionProps) {
  const { task } = props;
  return <article className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{task.title}</p><p className="mt-1 text-sm text-muted-foreground">{taskLabels[task.type]} · {formatTaskDeadline(task)}</p></div><Badge className={taskStatusClasses[task.status]}>{taskLabels[task.status]}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Badge className={taskPriorityClasses[task.priority]}>{taskLabels[task.priority]}</Badge>{task.case ? <Link className="text-sm font-medium text-primary hover:underline" href={`/akten/${task.case.id}`}>{task.case.caseNumber}</Link> : <span className="text-sm text-muted-foreground">Nicht zugeordnet</span>}</div><p className="mt-3 text-sm text-muted-foreground">{task.assignedMembership?.user.displayName ?? task.assignedMembership?.user.email ?? "Nicht zugewiesen"}</p><div className="mt-4"><TaskActions {...props} /></div></article>;
}
