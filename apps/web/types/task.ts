export type TaskType = "TASK" | "DEADLINE" | "FOLLOW_UP";
export type TaskStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type CaseTask = {
  id: string;
  caseId: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  title: string;
  description: string | null;
  dueAt: string | null;
  followUpAt: string | null;
  assignedMembershipId: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedMembership?: { id: string; user: { displayName: string | null; email: string } } | null;
};

export type CreateTaskInput = Pick<CaseTask, "caseId" | "type" | "priority" | "title"> & {
  description?: string;
  dueAt?: string;
  followUpAt?: string;
  assignedMembershipId?: string;
};
export type UpdateTaskInput = Partial<Omit<CreateTaskInput, "caseId">>;
export type TasksResponse = { items: CaseTask[]; page: number; pageSize: number; total: number; totalPages: number };
