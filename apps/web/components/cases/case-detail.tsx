"use client";

import { useParams } from "next/navigation";
import * as React from "react";

import type { Case } from "@/types/case";

import { caseApi } from "./case-api";
import { CaseDocuments } from "./case-documents";
import { CaseHeader } from "./case-header";
import { CaseOverview } from "./case-overview";
import { CasePayments } from "./case-payments";
import { CaseTabs } from "./case-tabs";
import { CaseTimeline } from "./case-timeline";

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
      <CaseHeader caseRecord={caseRecord} />
      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <CaseTabs />
          <CaseOverview caseRecord={caseRecord} />
          <CaseDocuments />
          <CasePayments />
        </div>
        <CaseTimeline />
      </div>
    </div>
  );
}
