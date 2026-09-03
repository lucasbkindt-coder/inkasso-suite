import { ArrowLeft, Building2, CalendarDays, CircleDollarSign, User } from "lucide-react";
import Link from "next/link";
import { PortalPreviewButton } from "@/components/portal/portal-preview-button";
import { CaseStatusControl } from "./case-status-control";
import { DeskCallButton } from "@/components/desk/desk-call-button";

import type { Case } from "@/types/case";

import {
  casePhaseLabels,
  casePriorityLabels,
  caseStatusLabels,
  formatCurrency,
  formatDate,
  priorityBadgeClasses,
  statusBadgeClasses,
} from "./case-ui";

export function CaseHeader({ caseRecord, onChanged }: { caseRecord: Case; onChanged: (caseRecord: Case) => void }) {
  const owner =
    caseRecord.assignedMembership?.user.displayName ??
    caseRecord.assignedMembership?.user.email ??
    "Nicht zugewiesen";
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
            href="/akten"
          >
            <ArrowLeft className="size-4" />
            Zur Aktenübersicht
          </Link>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            {caseRecord.caseNumber}
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">{caseRecord.debtorParty.displayName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DeskCallButton caseId={caseRecord.id} number={caseRecord.debtorParty.contacts.find((contact) => ["PHONE", "MOBILE"].includes(contact.type))?.value} partyId={caseRecord.debtorParty.id} />
          <PortalPreviewButton id={caseRecord.id} kind="debtor-case" label="Schuldnerportal öffnen" />
          <Link className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted" href={`/parteien/${caseRecord.debtorParty.id}`}>
            Schuldner öffnen
          </Link>
          <Link className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted" href={`/parteien/${caseRecord.clientParty.id}`}>
            Mandant öffnen
          </Link>
          <CaseActionButton action="document" label="Dokument erstellen" />
          <CaseActionButton action="payment" label="Zahlung erfassen" />
          <CaseActionButton action="task" label="Aufgabe anlegen" />
          <CaseStatusControl caseRecord={caseRecord} onChanged={onChanged} />
          <Badge className={statusBadgeClasses[caseRecord.status]}>
            {caseStatusLabels[caseRecord.status]}
          </Badge>
          <Badge className="bg-violet-500/10 text-violet-700 dark:text-violet-300">
            {casePhaseLabels[caseRecord.phase]}
          </Badge>
          <Badge className={priorityBadgeClasses[caseRecord.priority]}>
            {casePriorityLabels[caseRecord.priority]}
          </Badge>
        </div>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<CircleDollarSign className="size-5" />}
          label="Hauptforderung"
          value={
            caseRecord.claim
              ? formatCurrency(caseRecord.claim.principalAmount, caseRecord.claim.currency)
              : "—"
          }
        />
        <Metric
          icon={<Building2 className="size-5" />}
          label="Auftraggeber"
          value={caseRecord.clientParty.displayName}
        />
        <Metric icon={<User className="size-5" />} label="Sachbearbeiter" value={owner} />
        <Metric
          icon={<CalendarDays className="size-5" />}
          label="Eröffnet am"
          value={formatDate(caseRecord.openedAt)}
        />
      </div>
    </section>
  );
}

function CaseActionButton({ action, label }: { action: "document" | "payment" | "task"; label: string }) {
  return <button className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted" onClick={() => window.dispatchEvent(new CustomEvent("payveo:case-action", { detail: action }))} type="button">{label}</button>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-5">
      <div className="text-primary">{icon}</div>
      <p className="mt-3 text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-3 py-1.5 text-sm font-medium ${className}`}>{children}</span>
  );
}
