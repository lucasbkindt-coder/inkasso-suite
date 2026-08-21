"use client";

import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { CasePhase, CasePriority, CaseStatus, CasesResponse } from "@/types/case";

import { caseApi } from "./case-api";
import {
  casePhaseLabels,
  casePriorityLabels,
  caseStatusLabels,
  formatCurrency,
  formatDate,
  priorityBadgeClasses,
  statusBadgeClasses,
} from "./case-ui";
import { NewCaseDialog } from "./new-case-dialog";

const phases = Object.entries(casePhaseLabels) as [CasePhase, string][];
const statuses = Object.entries(caseStatusLabels) as [CaseStatus, string][];
const priorities = Object.entries(casePriorityLabels) as [CasePriority, string][];

export function CaseTable() {
  const [result, setResult] = React.useState<CasesResponse | null>(null);
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<CaseStatus | "">("");
  const [phase, setPhase] = React.useState<CasePhase | "">("");
  const [priority, setPriority] = React.useState<CasePriority | "">("");
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await caseApi.getCases({ page, pageSize: 20, search, status, phase, priority });
      setResult(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Akten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, phase, priority]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selectClass = "h-10 rounded-lg border bg-background px-3 text-sm";
  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Inkassoakten</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Laufende und abgeschlossene Inkassoakten verwalten.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> Neue Inkassoakte
        </Button>
      </div>

      <NewCaseDialog onOpenChange={setDialogOpen} onCreated={() => void load()} open={dialogOpen} />

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="grid gap-3 border-b p-4 lg:grid-cols-[minmax(0,1fr)_repeat(3,auto)]">
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Aktenzeichen, Rechnung, Auftraggeber oder Schuldner suchen"
              value={searchInput}
            />
          </div>
          <select
            className={selectClass}
            onChange={(event) => {
              setStatus(event.target.value as CaseStatus | "");
              setPage(1);
            }}
            value={status}
          >
            <option value="">Alle Status</option>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            onChange={(event) => {
              setPhase(event.target.value as CasePhase | "");
              setPage(1);
            }}
            value={phase}
          >
            <option value="">Alle Phasen</option>
            {phases.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            onChange={(event) => {
              setPriority(event.target.value as CasePriority | "");
              setPage(1);
            }}
            value={priority}
          >
            <option value="">Alle Prioritäten</option>
            {priorities.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="p-8 text-sm text-muted-foreground">Inkassoakten werden geladen …</p>
        ) : null}
        {!loading && error ? <p className="p-8 text-sm text-destructive">{error}</p> : null}
        {!loading && !error && result?.items.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground">
            Keine Inkassoakten entsprechen den aktuellen Filtern.
          </p>
        ) : null}
        {!loading && !error && result?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {[
                      "Aktenzeichen",
                      "Auftraggeber",
                      "Schuldner",
                      "Rechnungsnummer",
                      "Hauptforderung",
                      "Phase",
                      "Status",
                      "Priorität",
                      "Sachbearbeiter",
                      "Aktualisiert",
                    ].map((label) => (
                      <th className="px-4 py-3 font-medium" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr className="border-b last:border-0 hover:bg-muted/30" key={item.id}>
                      <td className="px-4 py-4 font-medium">
                        <Link className="text-primary hover:underline" href={`/akten/${item.id}`}>
                          {item.caseNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4">{item.clientParty.displayName}</td>
                      <td className="px-4 py-4">{item.debtorParty.displayName}</td>
                      <td className="px-4 py-4">{item.claim?.invoiceNumber ?? "—"}</td>
                      <td className="px-4 py-4 font-medium">
                        {item.claim
                          ? formatCurrency(item.claim.principalAmount, item.claim.currency)
                          : "—"}
                      </td>
                      <td className="px-4 py-4">{casePhaseLabels[item.phase]}</td>
                      <td className="px-4 py-4">
                        <Badge className={statusBadgeClasses[item.status]}>
                          {caseStatusLabels[item.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={priorityBadgeClasses[item.priority]}>
                          {casePriorityLabels[item.priority]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {item.ownerMembership?.user.displayName ??
                          item.ownerMembership?.user.email ??
                          "Nicht zugewiesen"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">{formatDate(item.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
              <span>
                {result.total} Akte{result.total === 1 ? "" : "n"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                  size="icon"
                  variant="outline"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span>
                  Seite {result.page} von {result.totalPages || 1}
                </span>
                <Button
                  disabled={page >= result.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  size="icon"
                  variant="outline"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
