"use client";

import { useParams } from "next/navigation";
import * as React from "react";

import type { Case } from "@/types/case";

import { caseApi } from "./case-api";
import { CaseDocuments } from "./case-documents";
import { CaseHeader } from "./case-header";
import { CaseOverview } from "./case-overview";
import { CaseLedger } from "./case-ledger";
import { CaseTabs } from "./case-tabs";
import { CaseTasks } from "./case-tasks";
import { CaseInstallmentPlan } from "./case-installment-plan";
import { CaseAssignee } from "./case-assignee";

export function CaseDetail() {
  const params = useParams<{ id: string }>();
  const [caseRecord, setCaseRecord] = React.useState<Case | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!params.id) return;
    void caseApi
      .getCase(params.id)
      .then((response) => {
        setCaseRecord(response);
        setError("");
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Akte konnte nicht geladen werden."),
      );
  }, [params.id]);

  if (error)
    return (
      <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {error}
      </p>
    );
  if (!caseRecord)
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Inkassoakte wird geladen …
      </p>
    );
  return (
    <div className="space-y-6">
      <CaseHeader caseRecord={caseRecord} onChanged={setCaseRecord} />
      <div>
        <div className="space-y-6">
          <CaseAssignee caseRecord={caseRecord} onAssigned={setCaseRecord} />
          <CaseTabs />
          <CaseOverview caseRecord={caseRecord} />
          <CaseInstallmentPlan caseId={caseRecord.id} />
          <CaseTasks caseId={caseRecord.id} />
          <CaseDocuments caseId={caseRecord.id} />
          <CaseLedger caseId={caseRecord.id} />
        </div>
      </div>
    </div>
  );
}
