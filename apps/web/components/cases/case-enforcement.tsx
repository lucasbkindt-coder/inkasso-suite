"use client";

import * as React from "react";

import { caseApi } from "./case-api";
import { formatCurrency, formatDate } from "./case-ui";
import type { EnforcementAction, EnforcementActionStatus, EnforcementActionType, EnforcementTitle, EnforcementTitleStatus, EnforcementTitleType } from "@/types/enforcement";

const titleLabels: Record<EnforcementTitleType, string> = { ENFORCEMENT_ORDER: "Vollstreckungsbescheid", JUDGMENT: "Urteil", COST_ASSESSMENT_ORDER: "Kostenfestsetzungsbeschluss", SETTLEMENT: "Vergleich", NOTARIAL_DEED: "Notarielle Urkunde", OTHER: "Sonstiger Titel" };
const actionLabels: Record<EnforcementActionType, string> = { BAILIFF_ORDER: "Gerichtsvollzieherauftrag", ASSET_DISCLOSURE: "Vermögensauskunft", GARNISHMENT: "Pfändung", ACCOUNT_GARNISHMENT: "Kontopfändung", WAGE_GARNISHMENT: "Lohn-/Gehaltspfändung", OTHER: "Sonstige Maßnahme" };
const actionStatusLabels: Record<EnforcementActionStatus, string> = { DRAFT: "Entwurf", PREPARED: "Vorbereitet", SUBMITTED: "Eingereicht", IN_PROGRESS: "In Bearbeitung", COMPLETED: "Abgeschlossen", FAILED: "Fehlgeschlagen", CANCELLED: "Abgebrochen" };
const actionTransitions: Record<EnforcementActionStatus, EnforcementActionStatus[]> = { DRAFT: ["PREPARED", "CANCELLED"], PREPARED: ["SUBMITTED", "CANCELLED"], SUBMITTED: ["IN_PROGRESS", "FAILED", "CANCELLED"], IN_PROGRESS: ["COMPLETED", "FAILED", "CANCELLED"], COMPLETED: [], FAILED: [], CANCELLED: [] };

export function CaseEnforcement({ caseId }: { caseId: string }) {
  const [titles, setTitles] = React.useState<EnforcementTitle[]>([]);
  const [actions, setActions] = React.useState<EnforcementAction[]>([]);
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [titleFormOpen, setTitleFormOpen] = React.useState(false);
  const [actionFormOpen, setActionFormOpen] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      const [nextTitles, nextActions] = await Promise.all([caseApi.getEnforcementTitles(caseId), caseApi.getEnforcementActions(caseId)]);
      setTitles(nextTitles); setActions(nextActions);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Titulierung konnte nicht geladen werden."); }
  }, [caseId]);
  React.useEffect(() => { void load(); }, [load]);
  const updateTitle = async (title: EnforcementTitle, status: EnforcementTitleStatus) => {
    setPending(true); setError("");
    try { await caseApi.updateEnforcementTitleStatus(caseId, title.id, status); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Titelstatus konnte nicht geändert werden."); }
    finally { setPending(false); }
  };
  const updateAction = async (action: EnforcementAction, status: EnforcementActionStatus) => {
    setPending(true); setError("");
    try { await caseApi.updateEnforcementActionStatus(caseId, action.id, status); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Status der Vollstreckungsmaßnahme konnte nicht geändert werden."); }
    finally { setPending(false); }
  };
  const activeTitles = titles.filter((title) => title.status === "ACTIVE");
  return <section className="rounded-2xl border bg-card p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Titulierung / Vollstreckung</h2><p className="mt-1 text-sm text-muted-foreground">Titel und interne Vollstreckungsvorbereitung. Keine externe Übermittlung.</p></div><div className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" disabled={pending || !activeTitles.length} onClick={() => setActionFormOpen((value) => !value)} type="button">{actionFormOpen ? "Erfassung schließen" : "Vollstreckungsmaßnahme anlegen"}</button><button className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50" disabled={pending} onClick={() => setTitleFormOpen((value) => !value)} type="button">{titleFormOpen ? "Erfassung schließen" : "Titel erfassen"}</button></div></div>
    {!activeTitles.length ? <p className="mt-3 text-xs text-muted-foreground">Eine Vollstreckungsmaßnahme kann erst nach Aktivierung eines Titels angelegt werden.</p> : null}
    {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    {titleFormOpen ? <TitleForm caseId={caseId} onDone={() => { setTitleFormOpen(false); void load(); }} onError={setError} /> : null}
    {actionFormOpen ? <ActionForm caseId={caseId} titles={activeTitles} onDone={() => { setActionFormOpen(false); void load(); }} onError={setError} /> : null}
    <div className="mt-5 space-y-3">{titles.map((title) => <div className="rounded-xl border p-4" key={title.id}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{titleLabels[title.type]} · {title.status === "DRAFT" ? "Entwurf" : title.status === "ACTIVE" ? "Aktiv" : title.status === "SATISFIED" ? "Erledigt" : "Annulliert"}</p><p className="text-sm text-muted-foreground">{title.courtOrAuthority ?? "Stelle nicht angegeben"} · {title.referenceNumber ?? "ohne Aktenzeichen"} · {formatDate(title.titleDate)}</p><p className="mt-1 text-sm">Tituliert: {formatCurrency(title.titleTotal, "EUR")}</p></div><div className="flex gap-2">{title.status === "DRAFT" ? <button className="rounded border px-2 py-1 text-sm" disabled={pending} onClick={() => void updateTitle(title, "ACTIVE")} type="button">Aktivieren</button> : null}{title.status === "ACTIVE" ? <><button className="rounded border px-2 py-1 text-sm" disabled={pending} onClick={() => void updateTitle(title, "SATISFIED")} type="button">Erledigt</button><button className="rounded border px-2 py-1 text-sm" disabled={pending} onClick={() => void updateTitle(title, "VOIDED")} type="button">Annullieren</button></> : null}</div></div></div>)}{!titles.length ? <p className="text-sm text-muted-foreground">Noch kein Titel erfasst.</p> : null}</div>
    <div className="mt-6 space-y-3"><h3 className="text-base font-semibold">Vollstreckungsmaßnahmen</h3>{actions.map((action) => <div className="rounded-xl border p-4" key={action.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{actionLabels[action.type]} · {actionStatusLabels[action.status]}</p><p className="mt-1 text-sm text-muted-foreground">Betrag bei Beauftragung: {formatCurrency(action.amountAtRequest, "EUR")}{action.referenceNumber ? ` · ${action.referenceNumber}` : ""}</p>{action.notes ? <p className="mt-1 text-sm text-muted-foreground">{action.notes}</p> : null}</div><div className="flex flex-wrap gap-2">{actionTransitions[action.status].map((status) => <button className="rounded border px-2 py-1 text-sm" disabled={pending} key={status} onClick={() => void updateAction(action, status)} type="button">{actionStatusLabels[status]}</button>)}</div></div></div>)}{!actions.length ? <p className="text-sm text-muted-foreground">Noch keine Vollstreckungsmaßnahme erfasst.</p> : null}</div>
  </section>;
}

function TitleForm({ caseId, onDone, onError }: { caseId: string; onDone: () => void; onError: (value: string) => void }) {
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({ type: "JUDGMENT" as EnforcementTitleType, titleDate: new Date().toISOString().slice(0, 10), principalAmount: "", costAmount: "0", interestAmount: "0", courtOrAuthority: "", referenceNumber: "", notes: "" });
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setPending(true); onError(""); try { await caseApi.createEnforcementTitle(caseId, form); onDone(); } catch (cause) { onError(cause instanceof Error ? cause.message : "Titel konnte nicht erfasst werden."); } finally { setPending(false); } };
  const field = (key: Exclude<keyof typeof form, "type">) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((value) => ({ ...value, [key]: event.target.value }));
  return <form className="mt-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}><label className="text-sm">Titelart<select className="mt-1 w-full rounded border bg-background p-2" onChange={(event) => setForm((value) => ({ ...value, type: event.target.value as EnforcementTitleType }))} value={form.type}>{(Object.keys(titleLabels) as EnforcementTitleType[]).map((type) => <option key={type} value={type}>{titleLabels[type]}</option>)}</select></label><label className="text-sm">Titeldatum<input className="mt-1 w-full rounded border bg-background p-2" onChange={field("titleDate")} required type="date" value={form.titleDate} /></label><label className="text-sm">Gericht/Stelle<input className="mt-1 w-full rounded border bg-background p-2" onChange={field("courtOrAuthority")} value={form.courtOrAuthority} /></label><label className="text-sm">Aktenzeichen<input className="mt-1 w-full rounded border bg-background p-2" onChange={field("referenceNumber")} value={form.referenceNumber} /></label><label className="text-sm">Hauptforderung<input className="mt-1 w-full rounded border bg-background p-2" onChange={field("principalAmount")} required value={form.principalAmount} /></label><label className="text-sm">Kosten<input className="mt-1 w-full rounded border bg-background p-2" onChange={field("costAmount")} value={form.costAmount} /></label><label className="text-sm">Zinsen<input className="mt-1 w-full rounded border bg-background p-2" onChange={field("interestAmount")} value={form.interestAmount} /></label><label className="text-sm">Notiz<textarea className="mt-1 w-full rounded border bg-background p-2" onChange={field("notes")} value={form.notes} /></label><button className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50 sm:col-span-2" disabled={pending} type="submit">{pending ? "Titel wird gespeichert …" : "Titel speichern"}</button></form>;
}

function ActionForm({ caseId, titles, onDone, onError }: { caseId: string; titles: EnforcementTitle[]; onDone: () => void; onError: (value: string) => void }) {
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({ titleId: titles[0]?.id ?? "", type: "BAILIFF_ORDER" as EnforcementActionType, amountAtRequest: "", referenceNumber: "", notes: "" });
  React.useEffect(() => { if (!titles.some((title) => title.id === form.titleId)) setForm((value) => ({ ...value, titleId: titles[0]?.id ?? "" })); }, [form.titleId, titles]);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setPending(true); onError(""); try { await caseApi.createEnforcementAction(caseId, form); onDone(); } catch (cause) { onError(cause instanceof Error ? cause.message : "Vollstreckungsmaßnahme konnte nicht angelegt werden."); } finally { setPending(false); } };
  return <form className="mt-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}><label className="text-sm">Titel<select className="mt-1 w-full rounded border bg-background p-2" onChange={(event) => setForm((value) => ({ ...value, titleId: event.target.value }))} required value={form.titleId}>{titles.map((title) => <option key={title.id} value={title.id}>{titleLabels[title.type]} · {title.referenceNumber ?? formatDate(title.titleDate)}</option>)}</select></label><label className="text-sm">Maßnahmenart<select className="mt-1 w-full rounded border bg-background p-2" onChange={(event) => setForm((value) => ({ ...value, type: event.target.value as EnforcementActionType }))} value={form.type}>{(Object.keys(actionLabels) as EnforcementActionType[]).map((type) => <option key={type} value={type}>{actionLabels[type]}</option>)}</select></label><label className="text-sm">Betrag bei Beauftragung<input className="mt-1 w-full rounded border bg-background p-2" onChange={(event) => setForm((value) => ({ ...value, amountAtRequest: event.target.value }))} required value={form.amountAtRequest} /></label><label className="text-sm">Interne Referenz<input className="mt-1 w-full rounded border bg-background p-2" onChange={(event) => setForm((value) => ({ ...value, referenceNumber: event.target.value }))} value={form.referenceNumber} /></label><label className="text-sm sm:col-span-2">Notiz<textarea className="mt-1 w-full rounded border bg-background p-2" onChange={(event) => setForm((value) => ({ ...value, notes: event.target.value }))} value={form.notes} /></label><button className="rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50 sm:col-span-2" disabled={pending || !form.titleId} type="submit">{pending ? "Maßnahme wird gespeichert …" : "Maßnahme als Entwurf anlegen"}</button></form>;
}
