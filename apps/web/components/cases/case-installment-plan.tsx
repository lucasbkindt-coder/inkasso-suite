"use client";

import Link from "next/link";
import * as React from "react";
import { caseApi } from "./case-api";
import { formatCurrency, formatDate } from "./case-ui";
import { installmentPlanStatusLabels, type InstallmentPlan } from "@/types/installment-plan";

export function CaseInstallmentPlan({ caseId }: { caseId: string }) {
  const [plans, setPlans] = React.useState<InstallmentPlan[]>([]);
  const [amount, setAmount] = React.useState("");
  const [count, setCount] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => { void caseApi.getInstallmentPlans().then(setPlans).catch(() => setError("Ratenpläne konnten nicht geladen werden.")); }, []);
  React.useEffect(load, [load]);
  const plan = plans.find((item) => item.case?.id === caseId);
  async function create() {
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return setError("Bitte geben Sie eine positive Ratenhöhe ein.");
    if (count && (!/^\d+$/.test(count) || Number(count) < 1)) return setError("Die Ratenanzahl muss eine positive ganze Zahl sein.");
    if (!startDate) return setError("Bitte geben Sie den ersten Fälligkeitstermin an.");
    setSaving(true); setError("");
    try { await caseApi.createStaffInstallmentPlan(caseId, { plannedInstallmentAmount: amount, numberOfInstallments: count ? Number(count) : undefined, startDate }); setAmount(""); setCount(""); setStartDate(""); load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Ratenplan konnte nicht angelegt werden."); }
    finally { setSaving(false); }
  }
  return <section className="rounded-2xl border bg-card p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Ratenplan</h2><p className="mt-1 text-sm text-muted-foreground">Interne Ratenpläne starten als Entwurf und nutzen die bestehende Planberechnung.</p></div>{plan ? <Link className="text-sm text-primary hover:underline" href={`/ratenplaene/${plan.id}`}>Ratenplan öffnen</Link> : null}</div>{plan ? <><div className="mt-5 grid gap-3 sm:grid-cols-3"><Info label="Planbetrag" value={formatCurrency(plan.initialOpenAmount,"EUR")} /><Info label="Vereinbarte Rate" value={formatCurrency(plan.plannedInstallmentAmount,"EUR")} /><Info label="Status" value={installmentPlanStatusLabels[plan.status]} /></div><p className="mt-4 text-sm text-muted-foreground">Nächste Rate: {plan.nextItem ? `${formatCurrency(plan.nextItem.remainingAmount,"EUR")} am ${formatDate(plan.nextItem.dueDate)}` : "keine offene Rate"}</p></> : <div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-sm">Gewünschte Ratenhöhe<input className="h-10 rounded-lg border bg-background px-3" disabled={saving} inputMode="decimal" onChange={(event) => setAmount(event.target.value)} value={amount} /></label><label className="grid gap-1 text-sm">Anzahl Raten <span className="text-muted-foreground">(optional)</span><input className="h-10 rounded-lg border bg-background px-3" disabled={saving} inputMode="numeric" onChange={(event) => setCount(event.target.value)} value={count} /></label><label className="grid gap-1 text-sm">Erste Fälligkeit<input className="h-10 rounded-lg border bg-background px-3" disabled={saving} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} /></label><div className="sm:col-span-3"><button className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={saving} onClick={() => void create()} type="button">{saving ? "Ratenplan wird angelegt …" : "Ratenplan anlegen"}</button></div></div>}{error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}</section>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
