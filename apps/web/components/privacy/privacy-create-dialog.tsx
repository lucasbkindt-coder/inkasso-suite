"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { privacyApi, type PrivacyOptions, type PrivacyRequestType } from "./privacy-api";

const fieldClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const defaultDueDate = () => {
  const value = new Date();
  value.setDate(value.getDate() + 30);
  return value.toISOString().slice(0, 10);
};

export function PrivacyCreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [options, setOptions] = React.useState<PrivacyOptions | null>(null);
  const [subjectKind, setSubjectKind] = React.useState<"PARTY" | "CLIENT_CONTACT">("PARTY");
  const [subjectId, setSubjectId] = React.useState("");
  const [requestType, setRequestType] = React.useState<PrivacyRequestType>("ACCESS");
  const [receivedAt, setReceivedAt] = React.useState(today());
  const [dueAt, setDueAt] = React.useState(defaultDueDate());
  const [assignedMembershipId, setAssignedMembershipId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    privacyApi.options().then(setOptions).catch((value: Error) => setError(value.message));
  }, []);

  const changeSubjectKind = (value: "PARTY" | "CLIENT_CONTACT") => {
    setSubjectKind(value);
    setSubjectId("");
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!subjectId) {
      setError("Bitte einen Betroffenen auswählen.");
      return;
    }
    if (!receivedAt || !dueAt) {
      setError("Bitte Eingangsdatum und Frist angeben.");
      return;
    }
    setBusy(true);
    setError("");
    void privacyApi.create({
      ...(subjectKind === "PARTY" ? { subjectPartyId: subjectId } : { clientContactId: subjectId }),
      requestType,
      receivedAt,
      dueAt,
      assignedMembershipId: assignedMembershipId || undefined,
      description: description.trim() || undefined,
    }).then((created) => onCreated(created.id)).catch((value: Error) => setError(value.message)).finally(() => setBusy(false));
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" role="presentation">
      <form className="max-h-[90vh] w-full max-w-2xl space-y-5 overflow-auto rounded-2xl border bg-card p-6 shadow-xl" onSubmit={submit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Datenschutzanfrage anlegen</h3>
            <p className="mt-1 text-sm text-muted-foreground">Betroffenen und Bearbeitung im aktuellen Mandanten erfassen.</p>
          </div>
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">Schließen</Button>
        </div>

        {!options && !error ? <p className="text-sm text-muted-foreground">Auswahlmöglichkeiten werden geladen …</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Art des Betroffenen</span>
            <select className={fieldClass} disabled={busy} onChange={(event) => changeSubjectKind(event.target.value as "PARTY" | "CLIENT_CONTACT")} value={subjectKind}>
              <option value="PARTY">Partei</option>
              <option value="CLIENT_CONTACT">Mandanten-Ansprechpartner</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Betroffener</span>
            <select className={fieldClass} disabled={busy || !options} onChange={(event) => setSubjectId(event.target.value)} required value={subjectId}>
              <option value="">Bitte auswählen</option>
              {subjectKind === "PARTY"
                ? options?.parties.map((party) => <option key={party.id} value={party.id}>{party.displayName} · {party.type === "PERSON" ? "Person" : "Unternehmen"}</option>)
                : options?.clientContacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.firstName} {contact.lastName} · {contact.party.displayName}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Anfrageart</span>
            <select className={fieldClass} disabled={busy} onChange={(event) => setRequestType(event.target.value as PrivacyRequestType)} value={requestType}>
              <option value="ACCESS">Auskunft</option>
              <option value="ERASURE">Löschung</option>
              <option value="RECTIFICATION">Berichtigung</option>
              <option value="RESTRICTION">Einschränkung</option>
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Bearbeiter</span>
            <select className={fieldClass} disabled={busy || !options} onChange={(event) => setAssignedMembershipId(event.target.value)} value={assignedMembershipId}>
              <option value="">Noch nicht zugewiesen</option>
              {options?.assignees.map((membership) => <option key={membership.id} value={membership.id}>{membership.user.displayName ?? membership.user.email}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Eingangsdatum</span>
            <input className={fieldClass} disabled={busy} onChange={(event) => setReceivedAt(event.target.value)} required type="date" value={receivedAt} />
          </label>
          <label className="space-y-1.5 text-sm">
            <span className="font-medium">Frist</span>
            <input className={fieldClass} disabled={busy} min={receivedAt} onChange={(event) => setDueAt(event.target.value)} required type="date" value={dueAt} />
          </label>
        </div>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Notiz</span>
          <textarea className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm" disabled={busy} maxLength={4000} onChange={(event) => setDescription(event.target.value)} value={description} />
        </label>
        {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button disabled={busy} onClick={onClose} type="button" variant="outline">Abbrechen</Button>
          <Button disabled={busy || !options} type="submit">{busy ? "Wird angelegt …" : "Datenschutzanfrage anlegen"}</Button>
        </div>
      </form>
    </div>
  );
}
