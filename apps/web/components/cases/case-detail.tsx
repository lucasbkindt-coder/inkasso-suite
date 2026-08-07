"use client";

import { CaseHeader } from "./case-header";
import { CaseOverview } from "./case-overview";
import { CaseTabs } from "./case-tabs";
import { CaseTimeline } from "./case-timeline";
import { CaseDocuments } from "./case-documents";
import { CasePayments } from "./case-payments";

export function CaseDetail() {
  return (
    <div className="space-y-6">

      <CaseHeader />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">

        <div className="space-y-6">
  <CaseTabs />
  <CaseOverview />
  <CaseDocuments />
  <CasePayments />
</div>

        <CaseTimeline />

      </div>

    </div>
  );
}