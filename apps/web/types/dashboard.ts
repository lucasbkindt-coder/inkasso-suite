import type { CasePhase, CasePriority } from "./case";
import type { TaskPriority, TaskType } from "./task";

export type DashboardTask = {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  dueAt: string | null;
  followUpAt: string | null;
  case: { id: string; caseNumber: string } | null;
};

export type DashboardSummary = {
  kpis: { activeCases: number; overdueTasks: number; todayTasks: number };
  ledger: {
    openPrincipal: string;
    openCosts: string;
    openInterest: string;
    totalOpen: string;
    unallocatedPayments: string;
  };
  tasks: { overdue: DashboardTask[]; today: DashboardTask[]; upcoming: DashboardTask[] };
  attentionCases: {
    id: string;
    caseNumber: string;
    phase: CasePhase;
    priority: CasePriority;
    updatedAt: string;
    clientParty: { displayName: string };
    debtorParty: { displayName: string };
  }[];
  recentPayments: {
    id: string;
    caseId: string;
    caseNumber: string;
    debtorName: string;
    bookingDate: string;
    amount: string;
    currency: string;
    allocationPolicy: "BGB_367_DEFAULT" | "CUSTOM" | null;
    unallocatedAmount: string;
  }[];
};
