"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { caseApi } from "@/components/cases/case-api";
import type { CaseTask, CreateTaskInput, TaskPriority, TaskType, UpdateTaskInput } from "@/types/task";
import { taskLabels } from "./task-ui";

type FormValues = {
  caseId: string;
  type: TaskType;
  priority: TaskPriority;
  title: string;
  description: string;
  dueAt: string;
  followUpAt: string;
  assignedMembershipId: string;
};

const emptyValues: FormValues = {
  caseId: "",
  type: "TASK",
  priority: "NORMAL",
  title: "",
  description: "",
  dueAt: "",
  followUpAt: "",
  assignedMembershipId: "",
};

const dateValue = (value: string | null) => value?.slice(0, 10) ?? "";

type TaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  task?: CaseTask | null;
  caseId?: string;
};

export function TaskDialog({ caseId, onOpenChange, onSaved, open, task = null }: TaskDialogProps) {
  const [values, setValues] = React.useState<FormValues>(emptyValues);
  const [cases, setCases] = React.useState<{ id: string; caseNumber: string; client: string; debtor: string }[]>([]);
  const [casesLoading, setCasesLoading] = React.useState(false);
  const [members, setMembers] = React.useState<{ membershipId: string; displayName: string; email: string }[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setValues(
      task
        ? {
            caseId: task.caseId ?? "",
            type: task.type,
            priority: task.priority,
            title: task.title,
            description: task.description ?? "",
            dueAt: dateValue(task.dueAt),
            followUpAt: dateValue(task.followUpAt),
            assignedMembershipId: task.assignedMembershipId ?? "",
          }
        : { ...emptyValues, caseId: caseId ?? "" },
    );
    setError("");
  }, [caseId, open, task]);

  React.useEffect(() => {
    if (!open) return;
    void caseApi.getStaffMembers().then(setMembers).catch(() => setError("Mitarbeiter konnten nicht geladen werden."));
  }, [open]);

  React.useEffect(() => {
    if (!open || caseId) return;
    setCasesLoading(true);
    void caseApi
      .getCases({ pageSize: 100 })
      .then((result) =>
        setCases(
          result.items.map((item) => ({
            id: item.id,
            caseNumber: item.caseNumber,
            client: item.clientParty.displayName,
            debtor: item.debtorParty.displayName,
          })),
        ),
      )
      .catch(() => setError("Inkassoakten konnten nicht geladen werden."))
      .finally(() => setCasesLoading(false));
  }, [caseId, open]);

  const setValue = <Key extends keyof FormValues>(key: Key, value: FormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!values.title.trim()) {
      setError("Titel ist erforderlich.");
      return;
    }
    if (values.type === "DEADLINE" && !values.dueAt) {
      setError("Für eine Frist ist eine Fälligkeit erforderlich.");
      return;
    }
    if (values.type === "FOLLOW_UP" && !values.dueAt && !values.followUpAt) {
      setError("Für eine Wiedervorlage ist ein Termin erforderlich.");
      return;
    }

    setSaving(true);
    setError("");
    const payload = {
      type: values.type,
      priority: values.priority,
      title: values.title.trim(),
      description: values.description || undefined,
      dueAt: values.dueAt || undefined,
      followUpAt: values.followUpAt || undefined,
      assignedMembershipId: values.assignedMembershipId || undefined,
    };

    try {
      if (task) {
        await caseApi.updateTask(task.id, payload as UpdateTaskInput);
      } else {
        await caseApi.createTask({ ...payload, caseId: values.caseId || undefined } as CreateTaskInput);
      }
      onSaved();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aufgabe konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">
            {task ? "Aufgabe bearbeiten" : "Aufgabe erstellen"}
          </Dialog.Title>
          <div className="mt-4 grid gap-3">
            {!caseId && !task ? (
              <label className="grid gap-1 text-sm">
                Akte <span className="text-muted-foreground">(optional)</span>
                <select
                  className="h-10 rounded-lg border bg-background px-3"
                  disabled={casesLoading || saving}
                  onChange={(event) => setValue("caseId", event.target.value)}
                  value={values.caseId}
                >
                  <option value="">Keine Akte zuordnen</option>
                  {cases.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.caseNumber} · {item.debtor} / {item.client}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="grid gap-1 text-sm">
              Typ
              <select className="h-10 rounded-lg border bg-background px-3" onChange={(event) => setValue("type", event.target.value as TaskType)} value={values.type}>
                {(["TASK", "DEADLINE", "FOLLOW_UP"] as TaskType[]).map((value) => <option key={value} value={value}>{taskLabels[value]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Titel<input className="h-10 rounded-lg border bg-background px-3" onChange={(event) => setValue("title", event.target.value)} value={values.title} /></label>
            <label className="grid gap-1 text-sm">Beschreibung<textarea className="min-h-20 rounded-lg border bg-background p-3" onChange={(event) => setValue("description", event.target.value)} value={values.description} /></label>
            <label className="grid gap-1 text-sm">
              Priorität
              <select className="h-10 rounded-lg border bg-background px-3" onChange={(event) => setValue("priority", event.target.value as TaskPriority)} value={values.priority}>
                {(["LOW", "NORMAL", "HIGH", "URGENT"] as TaskPriority[]).map((value) => <option key={value} value={value}>{taskLabels[value]}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Zuständig
              <select className="h-10 rounded-lg border bg-background px-3" disabled={saving} onChange={(event) => setValue("assignedMembershipId", event.target.value)} value={values.assignedMembershipId}>
                <option value="">Nicht zugewiesen</option>
                {members.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.displayName} · {member.email}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Fälligkeit<input className="h-10 rounded-lg border bg-background px-3" onChange={(event) => setValue("dueAt", event.target.value)} type="date" value={values.dueAt} /></label>
            <label className="grid gap-1 text-sm">Wiedervorlage<input className="h-10 rounded-lg border bg-background px-3" onChange={(event) => setValue("followUpAt", event.target.value)} type="date" value={values.followUpAt} /></label>
          </div>
          {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild><Button disabled={saving} variant="outline">Abbrechen</Button></Dialog.Close>
            <Button disabled={saving} onClick={() => void save()}>{saving ? <><Loader2 className="size-4 animate-spin" /> Speichert …</> : "Speichern"}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
