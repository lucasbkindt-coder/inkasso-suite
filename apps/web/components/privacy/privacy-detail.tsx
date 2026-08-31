"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { privacyApi, type PrivacyDataAction, type PrivacyOptions, type PrivacyRequest } from "./privacy-api";

const fieldClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
const date = (value: string) => new Intl.DateTimeFormat("de-DE").format(new Date(value));
const statusLabels: Record<string, string> = { RECEIVED: "Eingegangen", IDENTITY_CHECK: "Identitätsprüfung", IN_REVIEW: "In Prüfung", WAITING_INFORMATION: "Warten auf Informationen", APPROVED: "Genehmigt", PARTIALLY_APPROVED: "Teilweise genehmigt", REJECTED: "Abgelehnt", COMPLETED: "Abgeschlossen", CANCELLED: "Abgebrochen" };
const typeLabels: Record<string, string> = { ACCESS: "Auskunft", ERASURE: "Löschung", RECTIFICATION: "Berichtigung", RESTRICTION: "Einschränkung" };
const actionLabels: Record<PrivacyDataAction, string> = { REVIEW: "Prüfung offen", RETAIN: "Aufbewahren", RESTRICT: "Einschränken", ANONYMIZE: "Anonymisieren", DELETE: "Löschen" };
const categoryLabels: Record<string, string> = { MASTER_DATA: "Stammdaten", ADDRESSES: "Adressen", CONTACT_DATA: "Kontaktdaten", CASES: "Inkassoakten", CLAIMS: "Forderungen", LEDGER: "Forderungskonto", PAYMENTS: "Zahlungen", TASKS: "Aufgaben", DOCUMENTS: "Dokumente", COMMUNICATIONS: "Kommunikation", PORTAL: "Portal", INSTALLMENTS: "Ratenzahlungen", ENFORCEMENT: "Titel und Vollstreckung", ACTIVITY: "Aktivitätsprotokoll", CLIENT_CONTACT: "Mandanten-Ansprechpartner" };

type Run = (operation: () => Promise<unknown>, success: string) => void;

function ReviewRow({ item, requestId, busy, canManage, run }: { item: PrivacyRequest["reviews"][number]; requestId: string; busy: boolean; canManage: boolean; run: Run }) {
  const [finalAction, setFinalAction] = React.useState<PrivacyDataAction>(item.finalAction ?? "REVIEW");
  const [reason, setReason] = React.useState(item.reason ?? "");
  React.useEffect(() => { setFinalAction(item.finalAction ?? "REVIEW"); setReason(item.reason ?? ""); }, [item]);
  return (
    <div className="grid gap-3 border-t py-4 lg:grid-cols-[1.4fr_0.5fr_1fr_1fr_auto] lg:items-end">
      <div><p className="text-sm font-medium">{categoryLabels[item.category] ?? item.category}</p><p className="text-xs text-muted-foreground">Systemvorschlag: {actionLabels[item.proposedAction]}</p></div>
      <div><p className="text-xs text-muted-foreground">Anzahl</p><p className="mt-1 text-sm font-medium">{item.recordCount}</p></div>
      <label className="space-y-1 text-xs text-muted-foreground">Finale Entscheidung<select className={fieldClass} disabled={busy || !canManage} onChange={(event) => setFinalAction(event.target.value as PrivacyDataAction)} value={finalAction}>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1 text-xs text-muted-foreground">Begründung<input className={fieldClass} disabled={busy || !canManage} maxLength={4000} onChange={(event) => setReason(event.target.value)} placeholder={finalAction === "REVIEW" ? "Optional" : "Erforderlich"} value={reason} /></label>
      {canManage ? <Button disabled={busy || (finalAction !== "REVIEW" && !reason.trim())} onClick={() => run(() => privacyApi.review(requestId, item.category, { finalAction, reason: reason.trim() || undefined }), "Entscheidung gespeichert.")} type="button" variant="outline">Speichern</Button> : null}
    </div>
  );
}

export function PrivacyDetail({ id, canManage, canExport, onClose, onChanged }: { id: string; canManage: boolean; canExport: boolean; onClose: () => void; onChanged: () => void }) {
  const [item, setItem] = React.useState<PrivacyRequest | null>(null);
  const [options, setOptions] = React.useState<PrivacyOptions | null>(null);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [downloadBusy, setDownloadBusy] = React.useState<string | null>(null);
  const [identityDate, setIdentityDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [identityNote, setIdentityNote] = React.useState("");
  const [restrictionReason, setRestrictionReason] = React.useState("");
  const [decision, setDecision] = React.useState("");
  const [decisionReason, setDecisionReason] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const load = React.useCallback(() => {
    setError("");
    void privacyApi.get(id).then((value) => {
      setItem(value);
      setDecision(value.decision ?? "");
      setDecisionReason(value.decisionReason ?? "");
      setNotes(value.notes ?? "");
    }).catch((value: Error) => setError(value.message));
  }, [id]);

  React.useEffect(load, [load]);
  React.useEffect(() => {
    if (canManage) privacyApi.options().then(setOptions).catch((value: Error) => setError(value.message));
  }, [canManage]);

  const run: Run = (operation, message) => {
    setBusy(true); setError(""); setSuccess("");
    void operation().then(() => { setSuccess(message); load(); onChanged(); }).catch((value: Error) => setError(value.message)).finally(() => setBusy(false));
  };

  const download = (exportId: string) => {
    setDownloadBusy(exportId); setError("");
    void privacyApi.download(id, exportId).catch((value: Error) => setError(value.message)).finally(() => setDownloadBusy(null));
  };

  if (!item) return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4"><div className="rounded-xl border bg-card p-6 shadow-xl">{error || "Datenschutzfall wird geladen …"}</div></div>;
  const restricted = Boolean(item.subjectParty?.processingRestrictedAt);
  const subject = item.subjectParty?.displayName ?? `${item.clientContact?.firstName ?? ""} ${item.clientContact?.lastName ?? ""}`.trim();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" role="presentation">
      <div className="max-h-[94vh] w-full max-w-5xl space-y-6 overflow-auto rounded-2xl border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-primary">{typeLabels[item.requestType]}</p><h3 className="text-2xl font-semibold">Datenschutzfall</h3><p className="mt-1 text-sm text-muted-foreground">{subject}</p></div><Button disabled={busy} onClick={onClose} variant="outline">Schließen</Button></div>

        <section className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><p className="text-muted-foreground">Status</p><p className="font-medium">{statusLabels[item.status] ?? item.status}</p></div>
          <div><p className="text-muted-foreground">Eingang</p><p className="font-medium">{date(item.receivedAt)}</p></div>
          <div><p className="text-muted-foreground">Frist</p><p className="font-medium">{item.dueAt ? date(item.dueAt) : "—"}</p></div>
          <div><p className="text-muted-foreground">Bearbeiter</p><p className="font-medium">{item.assignedMembership?.user.displayName ?? item.assignedMembership?.user.email ?? "Nicht zugewiesen"}</p></div>
          <div><p className="text-muted-foreground">Identität</p><p className="font-medium">{item.identityVerifiedAt ? `Geprüft am ${date(item.identityVerifiedAt)}` : "Nicht geprüft"}</p></div>
          <div><p className="text-muted-foreground">Abschluss</p><p className="font-medium">{item.completedAt ? date(item.completedAt) : "Offen"}</p></div>
          {item.description ? <div className="sm:col-span-2 lg:col-span-3"><p className="text-muted-foreground">Anfrage / Notiz</p><p className="whitespace-pre-wrap font-medium">{item.description}</p></div> : null}
        </section>

        {canManage ? <section className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">Bearbeitung</h4><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="space-y-1 text-sm"><span>Bearbeiter</span><select className={fieldClass} disabled={busy || !options} onChange={(event) => run(() => privacyApi.update(id, { assignedMembershipId: event.target.value }), "Bearbeiter aktualisiert.")} value={item.assignedMembership?.id ?? ""}><option disabled value="">Bitte auswählen</option>{options?.assignees.map((membership) => <option key={membership.id} value={membership.id}>{membership.user.displayName ?? membership.user.email}</option>)}</select></label><Button disabled={busy} onClick={() => run(() => privacyApi.update(id, { notes }), "Notizen gespeichert.")} type="button" variant="outline">Notizen speichern</Button></div><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" disabled={busy} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder="Interne Bearbeitungsnotizen" value={notes} /></section> : null}

        <section className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">Identitätsprüfung</h4>{item.identityVerifiedAt ? <div className="text-sm"><p>Geprüft am {date(item.identityVerifiedAt)} durch {item.identityVerifiedBy?.user.displayName ?? item.identityVerifiedBy?.user.email ?? "Mitarbeiter"}.</p>{item.identityVerificationNote ? <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{item.identityVerificationNote}</p> : null}</div> : canManage ? <div className="grid gap-3 sm:grid-cols-[12rem_1fr_auto] sm:items-end"><label className="space-y-1 text-sm"><span>Prüfdatum</span><input className={fieldClass} disabled={busy} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setIdentityDate(event.target.value)} type="date" value={identityDate} /></label><label className="space-y-1 text-sm"><span>Notiz</span><input className={fieldClass} disabled={busy} maxLength={2000} onChange={(event) => setIdentityNote(event.target.value)} value={identityNote} /></label><Button disabled={busy || !identityDate} onClick={() => run(() => privacyApi.verify(id, { verifiedAt: `${identityDate}T00:00:00.000Z`, note: identityNote.trim() || undefined }), "Identität wurde als geprüft markiert.")} type="button">Identität als geprüft markieren</Button></div> : <p className="text-sm text-muted-foreground">Die Identität wurde noch nicht geprüft.</p>}</section>

        {item.requestType === "ACCESS" ? <section className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold">Auskunftsexporte</h4><p className="text-sm text-muted-foreground">Unveränderliche JSON-Snapshots der gespeicherten Daten.</p></div>{canExport ? <Button disabled={busy || !item.identityVerifiedAt} onClick={() => run(() => privacyApi.export(id), "Auskunftsexport erstellt.")} type="button">{busy ? "Wird erstellt …" : "Auskunft erstellen"}</Button> : null}</div>{!item.identityVerifiedAt ? <p className="rounded-lg bg-muted p-3 text-sm">Vor Erstellung einer Auskunft muss die Identität geprüft werden.</p> : null}{item.exports.length ? <div className="divide-y rounded-lg border">{item.exports.map((value) => <div className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm" key={value.id}><div><p className="font-medium">{value.format} · {date(value.generatedAt)}</p><p className="text-muted-foreground">Erstellt von {value.generatedByMembership.user.displayName ?? value.generatedByMembership.user.email}</p></div>{canExport ? <Button disabled={downloadBusy !== null} onClick={() => download(value.id)} type="button" variant="outline">{downloadBusy === value.id ? "Download …" : "Sicher herunterladen"}</Button> : null}</div>)}</div> : <p className="text-sm text-muted-foreground">Noch kein Auskunftsexport vorhanden.</p>}</section> : null}

        {item.requestType === "ERASURE" ? <section className="rounded-xl border p-4"><div className="mb-2"><h4 className="font-semibold">Löschprüfung</h4><p className="text-sm text-muted-foreground">„Löschen“ dokumentiert in P1 ausschließlich die Entscheidung und führt keine physische Löschung aus.</p></div>{item.reviews.map((review) => <ReviewRow busy={busy} canManage={canManage} item={review} key={review.category} requestId={id} run={run} />)}</section> : null}

        {item.requestType === "RESTRICTION" ? <section className="space-y-3 rounded-xl border p-4"><div><h4 className="font-semibold">Verarbeitungseinschränkung</h4><p className="text-sm text-muted-foreground">Aktueller Zustand: {restricted ? `eingeschränkt seit ${date(item.subjectParty!.processingRestrictedAt!)}` : "nicht eingeschränkt"}</p></div>{canManage ? <><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" disabled={busy} maxLength={2000} onChange={(event) => setRestrictionReason(event.target.value)} placeholder="Begründung (erforderlich)" value={restrictionReason} /><Button disabled={busy || !restrictionReason.trim()} onClick={() => run(() => privacyApi.restriction(id, !restricted, restrictionReason), restricted ? "Einschränkung aufgehoben." : "Verarbeitung eingeschränkt.")} type="button">{restricted ? "Einschränkung aufheben" : "Verarbeitung einschränken"}</Button></> : null}</section> : null}

        {item.requestType === "RECTIFICATION" ? <section className="space-y-3 rounded-xl border p-4"><h4 className="font-semibold">Berichtigungsentscheidung</h4><input className={fieldClass} disabled={busy || !canManage} maxLength={1000} onChange={(event) => setDecision(event.target.value)} placeholder="Entscheidung" value={decision} /><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" disabled={busy || !canManage} maxLength={4000} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Begründung" value={decisionReason} />{canManage ? <Button disabled={busy || !decision.trim()} onClick={() => run(() => privacyApi.update(id, { decision, decisionReason }), "Entscheidung gespeichert.")} type="button" variant="outline">Entscheidung speichern</Button> : null}</section> : null}

        {item.decision ? <section className="rounded-xl border p-4 text-sm"><h4 className="font-semibold">Entscheidung</h4><p className="mt-2">{item.decision}</p>{item.decisionReason ? <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.decisionReason}</p> : null}</section> : null}
        {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        {success ? <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{success}</p> : null}
        <div className="flex justify-end">{canManage && item.status !== "COMPLETED" ? <Button disabled={busy} onClick={() => run(() => privacyApi.update(id, { status: "COMPLETED" }), "Datenschutzanfrage abgeschlossen.")} type="button">{busy ? "Wird verarbeitet …" : "Anfrage abschließen"}</Button> : null}</div>
      </div>
    </div>
  );
}
