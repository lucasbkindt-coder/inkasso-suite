"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { caseApi } from "./case-api";
import type { Case } from "@/types/case";

export function CaseAssignee({ caseRecord, onAssigned }: { caseRecord: Case; onAssigned: (record: Case) => void }) {
  const [members, setMembers] = React.useState<{ membershipId: string; displayName: string; email: string }[]>([]); const [pending, setPending] = React.useState(false); const [error, setError] = React.useState("");
  React.useEffect(() => { void caseApi.getStaffMembers().then(setMembers).catch(() => setError("Mitarbeiter konnten nicht geladen werden.")); }, []);
  async function assign(membershipId: string) { setPending(true); setError(""); try { onAssigned(await caseApi.assignCase(caseRecord.id, membershipId || null)); } catch (cause) { setError(cause instanceof Error ? cause.message : "Zuweisung konnte nicht gespeichert werden."); } finally { setPending(false); } }
  return <div className="rounded-xl border bg-card p-4"><p className="text-sm font-semibold">Sachbearbeitung</p><select className="mt-3 h-10 w-full rounded-lg border bg-background px-3 text-sm" disabled={pending} onChange={(event) => void assign(event.target.value)} value={caseRecord.assignedMembership?.id ?? ""}><option value="">Nicht zugewiesen</option>{members.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.displayName} · {member.email}</option>)}</select>{pending ? <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Wird gespeichert …</p> : null}{error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}</div>;
}
