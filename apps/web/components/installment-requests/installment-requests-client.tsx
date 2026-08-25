"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { caseApi } from "@/components/cases/case-api";
import { formatCurrency, formatDate } from "@/components/cases/case-ui";
import { installmentRequestStatusLabels, type InstallmentRequest } from "@/types/installment-request";

type PendingAction = "review" | "approve" | "reject" | "create-plan" | null;

export function InstallmentRequestsClient({ id }: { id?: string }) {
  const router = useRouter();
  const [items, setItems] = React.useState<InstallmentRequest[]>([]);
  const [detail, setDetail] = React.useState<InstallmentRequest | null>(null);
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setError("");
    try {
      if (id) setDetail(await caseApi.getInstallmentRequest(id));
      else setItems(await caseApi.getInstallmentRequests());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ratenanfragen konnten nicht geladen werden.");
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const action = async (kind: Exclude<PendingAction, "create-plan" | null>) => {
    if (!detail || pendingAction) return;
    setPendingAction(kind);
    setError("");
    try {
      const next = kind === "review"
        ? await caseApi.reviewInstallmentRequest(detail.id)
        : kind === "approve"
          ? await caseApi.approveInstallmentRequest(detail.id)
          : await caseApi.rejectInstallmentRequest(detail.id);
      setDetail(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Aktion nicht möglich.");
    } finally {
      setPendingAction(null);
    }
  };

  const createPlan = async () => {
    if (!detail || pendingAction) return;
    setPendingAction("create-plan");
    setError("");
    try {
      const plan = await caseApi.createInstallmentPlan(detail.id);
      router.push(`/ratenplaene/${plan.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ratenplan konnte nicht erstellt werden.");
    } finally {
      setPendingAction(null);
    }
  };

  if (!id) {
    return <section><h1 className="text-3xl font-semibold">Ratenanfragen</h1>{error ? <p className="mt-4 text-destructive">{error}</p> : null}<div className="mt-6 space-y-3">{items.map((item) => <Link className="block rounded-xl border bg-card p-4 hover:bg-muted/50" href={`/ratenanfragen/${item.id}`} key={item.id}><strong>{item.case?.debtorParty.displayName} · {item.case?.caseNumber}</strong><p className="mt-1 text-sm text-muted-foreground">{formatCurrency(item.requestedMonthlyAmount, "EUR")} ab {formatDate(item.preferredStartDate)} · {installmentRequestStatusLabels[item.status]}</p></Link>)}</div></section>;
  }

  return <section className="space-y-6"><Link className="text-sm text-primary hover:underline" href="/ratenanfragen">← Ratenanfragen</Link>{error ? <p className="text-destructive">{error}</p> : null}{!detail ? <p>Laden …</p> : <><h1 className="text-3xl font-semibold">Ratenanfrage</h1><div className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"><p>Aktenzeichen<br /><strong>{detail.case?.caseNumber}</strong></p><p>Schuldner<br /><strong>{detail.case?.debtorParty.displayName}</strong></p><p>Monatsrate<br /><strong>{formatCurrency(detail.requestedMonthlyAmount, "EUR")}</strong></p><p>Starttermin<br /><strong>{formatDate(detail.preferredStartDate)}</strong></p><p>Status<br /><strong>{installmentRequestStatusLabels[detail.status]}</strong></p><p>Nachricht<br /><strong>{detail.debtorMessage || "—"}</strong></p></div>{detail.status === "SUBMITTED" || detail.status === "UNDER_REVIEW" ? <div className="flex flex-wrap gap-2">{detail.status === "SUBMITTED" ? <button className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={pendingAction !== null} onClick={() => void action("review")} type="button">{pendingAction === "review" ? "Wird geprüft …" : "In Prüfung setzen"}</button> : null}<button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={pendingAction !== null} onClick={() => void action("approve")} type="button">{pendingAction === "approve" ? "Wird genehmigt …" : "Genehmigen"}</button><button className="rounded-lg border px-3 py-2 disabled:opacity-50" disabled={pendingAction !== null} onClick={() => void action("reject")} type="button">{pendingAction === "reject" ? "Wird abgelehnt …" : "Ablehnen"}</button></div> : detail.status === "APPROVED" ? <div className="flex flex-wrap items-center gap-3"><button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" disabled={pendingAction !== null} onClick={() => void createPlan()} type="button">{pendingAction === "create-plan" ? "Ratenplan wird erstellt …" : "Ratenplan erstellen"}</button></div> : null}</>}</section>;
}
