import type { CasePhase, CasePriority, CaseStatus } from "@/types/case";

export const caseStatusLabels: Record<CaseStatus, string> = {
  OPEN: "Offen",
  CLOSED: "Abgeschlossen",
  CANCELLED: "Storniert",
};

export const casePhaseLabels: Record<CasePhase, string> = {
  NEW: "Neu",
  PRE_COLLECTION: "Vorprüfung",
  OUT_OF_COURT: "Außergerichtlich",
  PAYMENT_PLAN: "Ratenzahlung",
  JUDICIAL_DUNNING: "Gerichtliches Mahnverfahren",
  LITIGATION: "Klageverfahren",
  ENFORCEMENT: "Vollstreckung",
  MONITORING: "Überwachung",
  COMPLETED: "Erledigt",
};

export const casePriorityLabels: Record<CasePriority, string> = {
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

export const statusBadgeClasses: Record<CaseStatus, string> = {
  OPEN: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  CLOSED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const priorityBadgeClasses: Record<CasePriority, string> = {
  LOW: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  NORMAL: "bg-primary/10 text-primary",
  HIGH: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  URGENT: "bg-red-500/10 text-red-700 dark:text-red-300",
};

export function formatCurrency(value: string, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(value));
}

export function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("de-DE").format(new Date(value)) : "—";
}
