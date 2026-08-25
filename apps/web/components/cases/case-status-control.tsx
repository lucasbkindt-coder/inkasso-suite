"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";
import type { Case } from "@/types/case";

import { caseApi } from "./case-api";
import { caseStatusLabels } from "./case-ui";

export function CaseStatusControl({ caseRecord, onChanged }: { caseRecord: Case; onChanged: (caseRecord: Case) => void }) {
  const [targets, setTargets] = React.useState<Case["status"][]>([]);
  const [allowed, setAllowed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void staffAuthApi.session().then((session) => setAllowed(session.permissions.includes("case:update"))).catch(() => setAllowed(false));
    void caseApi.getCaseStatusTransitions(caseRecord.id).then((value) => setTargets(value.allowedTargetStatuses)).catch(() => setTargets([]));
  }, [caseRecord.id, caseRecord.status]);

  if (!allowed || !targets.length) return null;
  return <div className="flex flex-wrap items-center gap-2"><select aria-label="Neuer Aktenstatus" className="h-9 rounded-lg border bg-background px-2 text-sm" disabled={pending} onChange={(event) => { const target = event.target.value as Case["status"]; if (!target) return; setPending(true); setError(""); void caseApi.transitionCaseStatus(caseRecord.id, target).then(onChanged).catch((cause) => setError(cause instanceof Error ? cause.message : "Status konnte nicht geändert werden.")).finally(() => setPending(false)); event.currentTarget.value = ""; }} value=""><option value="">Status ändern …</option>{targets.map((target) => <option key={target} value={target}>{caseStatusLabels[target]}</option>)}</select>{pending ? <Button disabled variant="outline">Speichert …</Button> : null}{error ? <span className="text-xs text-destructive">{error}</span> : null}</div>;
}
