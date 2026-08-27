"use client";

import { Loader2 } from "lucide-react";
import * as React from "react";
import type { Case } from "@/types/case";
import { caseApi } from "./case-api";

type Member = { membershipId: string; displayName: string; email: string };
const managerRoles = new Set(["Teamleiter", "Administrator", "Tenant Owner"]);

export function CaseAssignee({ caseRecord, onAssigned }: { caseRecord: Case; onAssigned: (record: Case) => void }) {
  const [members, setMembers] = React.useState<Member[]>([]);
  const [currentMembershipId, setCurrentMembershipId] = React.useState("");
  const [canManage, setCanManage] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void Promise.all([caseApi.getStaffMembers(), caseApi.getStaffSession()]).then(([availableMembers, session]) => {
      setMembers(availableMembers);
      setCurrentMembershipId(session.membership.id);
      setCanManage(session.roles.some((role) => managerRoles.has(role)));
    }).catch(() => setError("Mitarbeiter konnten nicht geladen werden."));
  }, []);

  async function assign(membershipId: string | null) {
    setPending(true); setError("");
    try { onAssigned(await caseApi.assignCase(caseRecord.id, membershipId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Zuweisung konnte nicht gespeichert werden."); }
    finally { setPending(false); }
  }

  const assignedName = caseRecord.assignedMembership?.user.displayName ?? caseRecord.assignedMembership?.user.email;
  return <section className="rounded-2xl border bg-card p-6 shadow-sm"><h2 className="text-xl font-semibold">Sachbearbeitung</h2>{canManage ? <label className="mt-4 grid gap-1 text-sm">Zuständigkeit ändern<select className="h-10 rounded-lg border bg-background px-3" disabled={pending} onChange={(event) => void assign(event.target.value || null)} value={caseRecord.assignedMembership?.id ?? ""}><option value="">Nicht zugewiesen</option>{members.map((member) => <option key={member.membershipId} value={member.membershipId}>{member.displayName} · {member.email}</option>)}</select></label> : caseRecord.assignedMembership ? <p className="mt-3 text-sm text-muted-foreground">Zuständig: <strong className="text-foreground">{assignedName ?? "Unbekannt"}</strong></p> : <div className="mt-4"><p className="text-sm text-muted-foreground">Diese Akte ist nicht zugewiesen.</p><button className="mt-3 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={pending || !currentMembershipId} onClick={() => void assign(currentMembershipId)} type="button">Akte übernehmen</button></div>}{pending ? <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Wird gespeichert …</p> : null}{error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}</section>;
}
