"use client";

import { useParams } from "next/navigation";
import * as React from "react";

import type { Case } from "@/types/case";

import { caseApi } from "./case-api";
import { CaseDocuments } from "./case-documents";
import { CaseHeader } from "./case-header";
import { CaseOverview } from "./case-overview";
import { CaseLedger } from "./case-ledger";
import { CaseTasks } from "./case-tasks";
import { CaseInstallmentPlan } from "./case-installment-plan";
import { CaseAssignee } from "./case-assignee";
import { CaseTimeline } from "./case-timeline";
import { CaseEnforcement } from "./case-enforcement";
import { CommunicationPanel } from "@/components/communications/communication-panel";
import { AddressResearchPanel } from "@/components/address-research/address-research-panel";
import { CreditReportPanel } from "@/components/credit-reporting/credit-report-panel";

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
      <div className="space-y-6">
        <CaseLedger caseId={caseRecord.id} />
        <CaseAssignee caseRecord={caseRecord} onAssigned={setCaseRecord} />
        <CaseOverview caseRecord={caseRecord} />
        <CaseTasks caseId={caseRecord.id} />
        <CommunicationPanel caseId={caseRecord.id} partyId={caseRecord.debtorParty.id} />
        <AddressResearchPanel caseId={caseRecord.id} compact partyId={caseRecord.debtorParty.id} />
        <CreditReportPanel caseId={caseRecord.id} compact partyId={caseRecord.debtorParty.id} />
        <CaseDocuments caseId={caseRecord.id} caseStatus={caseRecord.status} debtorType={caseRecord.debtorParty.type} />
        <CaseInstallmentPlan caseId={caseRecord.id} />
        <CaseEnforcement caseId={caseRecord.id} />
        <CaseTimeline caseId={caseRecord.id} />
      </div>
    </div>
  );
}
