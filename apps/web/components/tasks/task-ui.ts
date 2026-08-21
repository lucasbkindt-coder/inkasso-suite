import type { CaseTask, TaskPriority, TaskStatus, TaskType } from "@/types/task";

export const taskLabels: Record<TaskType | TaskStatus | TaskPriority, string> = {
  TASK: "Aufgabe",
  DEADLINE: "Frist",
  FOLLOW_UP: "Wiedervorlage",
  OPEN: "Offen",
  IN_PROGRESS: "In Bearbeitung",
  COMPLETED: "Erledigt",
  CANCELLED: "Abgebrochen",
  LOW: "Niedrig",
  NORMAL: "Normal",
  HIGH: "Hoch",
  URGENT: "Dringend",
};

export const taskPriorityClasses: Record<TaskPriority, string> = {
  LOW: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  NORMAL: "bg-primary/10 text-primary",
  HIGH: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  URGENT: "bg-destructive/10 text-destructive",
};

export const taskStatusClasses: Record<TaskStatus, string> = {
  OPEN: "bg-primary/10 text-primary",
  IN_PROGRESS: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  COMPLETED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

export function isTaskOpen(task: CaseTask) {
  return task.status !== "COMPLETED" && task.status !== "CANCELLED";
}

export function taskDate(task: CaseTask) {
  return task.dueAt ?? task.followUpAt;
}

export function formatTaskDeadline(task: CaseTask, now = new Date()) {
  const value = taskDate(task);
  if (!value) return "Kein Termin";

  const target = new Date(value);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const difference = Math.round((targetDay - today) / 86_400_000);

  if (isTaskOpen(task) && difference < 0) return `Überfällig seit ${Math.abs(difference)} Tagen`;
  if (difference === 0) return "Heute";
  if (difference === 1) return "Morgen";
  return new Intl.DateTimeFormat("de-DE").format(target);
}

export function taskSortValue(task: CaseTask) {
  const value = taskDate(task);
  if (!value) return [3, 0, priorityValue(task.priority), 0] as const;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const taskDay = new Date(value).setHours(0, 0, 0, 0);
  const group = taskDay < today ? 0 : taskDay === today ? 1 : 2;
  return [group, taskDay, priorityValue(task.priority), new Date(task.createdAt).getTime()] as const;
}

function priorityValue(priority: TaskPriority) {
  return { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[priority];
}
