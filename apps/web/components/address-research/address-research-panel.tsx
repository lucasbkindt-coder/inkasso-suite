"use client";

import { CheckCircle2, MapPin, Plus, Search, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";
import type { AddressResearch, AddressResearchConfidence, AddressResearchOptions, AddressResearchReason, AddressResearchStatus } from "@/types/address-research";
import { addressResearchApi } from "./address-research-api";

const statusLabels: Record<AddressResearchStatus, string> = { CREATED: "Angelegt", IN_PROGRESS: "In Bearbeitung", RESULT_AVAILABLE: "Ergebnis vorhanden", NO_RESULT: "Kein Ergebnis", REVIEW_REQUIRED: "Prüfung erforderlich", APPLIED: "Übernommen", CANCELLED: "Abgebrochen", ERROR: "Fehler" };
const reasonLabels: Record<AddressResearchReason, string> = { UNKNOWN_ADDRESS: "Anschrift unbekannt", RETURNED_MAIL: "Postrücklauf", MOVED: "Verzogen", ADDRESS_UNCONFIRMED: "Anschrift unbestätigt", ENFORCEMENT_PREPARATION: "Vollstreckungsvorbereitung", OTHER: "Sonstiger Anlass" };
const confidenceLabels: Record<AddressResearchConfidence, string> = { HIGH: "Hoch", MEDIUM: "Mittel", LOW: "Niedrig" };
const openStatuses: AddressResearchStatus[] = ["CREATED", "IN_PROGRESS", "RESULT_AVAILABLE", "REVIEW_REQUIRED"];
const fieldClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
const textAreaClass = "min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

export function AddressResearchPanel({ partyId, caseId, compact = false }: { partyId?: string; caseId?: string; compact?: boolean }) {
  const [items, setItems] = React.useState<AddressResearch[]>([]);
  const [options, setOptions] = React.useState<AddressResearchOptions | null>(null);
  const [selected, setSelected] = React.useState<AddressResearch | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [resultOpen, setResultOpen] = React.useState(false);
  const [status, setStatus] = React.useState<AddressResearchStatus | "">("");
  const [reason, setReason] = React.useState<AddressResearchReason | "">("");
  const [assignee, setAssignee] = React.useState("");
  const [canManage, setCanManage] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, values, session] = await Promise.all([
        addressResearchApi.list({ partyId, caseId, status: status || undefined, reason: reason || undefined, requestedByMembershipId: assignee || undefined }),
        addressResearchApi.options(),
        staffAuthApi.session(),
      ]);
      setItems(list.items);
      setOptions(values);
      setCanManage(session.permissions.includes("address-research:manage"));
      if (selected) setSelected(list.items.find((item) => item.id === selected.id) ?? null);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Adressermittlungen konnten nicht geladen werden."); }
    finally { setLoading(false); }
  }, [partyId, caseId, status, reason, assignee, selected?.id]);

  React.useEffect(() => { void load(); }, [load]);

  async function action(run: () => Promise<unknown>, success: string) {
    setBusy(true); setError(""); setMessage("");
    try { await run(); setMessage(success); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Aktion fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" id="address-research">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3"><div className="rounded-lg bg-primary/10 p-3 text-primary"><MapPin className="size-5" /></div><div><h2 className="text-xl font-semibold">Adressermittlung</h2><p className="mt-1 text-sm text-muted-foreground">Schuldneranschriften prüfen, Ergebnisse dokumentieren und kontrolliert übernehmen.</p></div></div>
        {canManage ? <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Adressrecherche starten</Button> : null}
      </div>
      {!compact ? <div className="mt-5 grid gap-3 md:grid-cols-3">
        <select className={fieldClass} onChange={(event) => setStatus(event.target.value as AddressResearchStatus | "")} value={status}><option value="">Alle Status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={fieldClass} onChange={(event) => setReason(event.target.value as AddressResearchReason | "")} value={reason}><option value="">Alle Anlässe</option>{Object.entries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={fieldClass} onChange={(event) => setAssignee(event.target.value)} value={assignee}><option value="">Alle Bearbeiter</option>{options?.assignees.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select>
      </div> : null}
      {message ? <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {loading ? <p className="mt-5 text-sm text-muted-foreground">Adressermittlungen werden geladen …</p> : <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="px-2 py-3">Schuldner</th><th className="px-2 py-3">Akte</th><th className="px-2 py-3">Anlass</th><th className="px-2 py-3">Status</th><th className="px-2 py-3">Angelegt</th><th className="px-2 py-3">Bearbeiter</th><th className="px-2 py-3">Ergebnisse</th></tr></thead><tbody>{items.map((item) => <tr className="cursor-pointer border-b hover:bg-muted/50" key={item.id} onClick={() => setSelected(item)}><td className="px-2 py-3 font-medium">{item.party.displayName}</td><td className="px-2 py-3">{item.case?.caseNumber ?? "—"}</td><td className="px-2 py-3">{item.reason ? reasonLabels[item.reason] : "—"}</td><td className="px-2 py-3"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{statusLabels[item.status]}</span></td><td className="px-2 py-3">{formatDate(item.requestedAt)}</td><td className="px-2 py-3">{item.requestedByMembership.user.displayName ?? item.requestedByMembership.user.email}</td><td className="px-2 py-3">{item.resultCount}</td></tr>)}</tbody></table>{!items.length ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Keine Adressermittlungen vorhanden.</p> : null}</div>}
      {createOpen && options ? <CreateDialog caseId={caseId} fixedPartyId={partyId} options={options} busy={busy} onClose={() => setCreateOpen(false)} onCreate={(payload) => action(() => addressResearchApi.create(payload).then((created) => { setCreateOpen(false); setSelected(created); }), "Adressermittlung wurde angelegt.")} /> : null}
      {selected ? <DetailDialog item={selected} canManage={canManage} busy={busy} onClose={() => setSelected(null)} onAddResult={() => setResultOpen(true)} onAction={action} /> : null}
      {selected && resultOpen ? <ResultDialog busy={busy} onClose={() => setResultOpen(false)} onCreate={(payload) => action(() => addressResearchApi.addResult(selected.id, payload).then(() => setResultOpen(false)), "Rechercheergebnis wurde erfasst.")} /> : null}
    </section>
  );
}

function CreateDialog({ options, fixedPartyId, caseId, busy, onClose, onCreate }: { options: AddressResearchOptions; fixedPartyId?: string; caseId?: string; busy: boolean; onClose(): void; onCreate(payload: Parameters<typeof addressResearchApi.create>[0]): Promise<void> }) {
  const [party, setParty] = React.useState(fixedPartyId ?? "");
  const matchingCases = options.cases.filter((item) => item.debtorPartyId === party);
  return <Modal title="Adressrecherche starten" onClose={onClose}><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); const costAmount = String(data.get("costAmount") || "").replace(",", "."); void onCreate({ partyId: party, caseId: String(data.get("caseId") || "") || undefined, reason: String(data.get("reason") || "") as AddressResearchReason || undefined, provider: String(data.get("provider")) as "MANUAL" | "MOCK", notes: String(data.get("notes") || "") || undefined, costAmount: costAmount || undefined, costCurrency: costAmount ? "EUR" : undefined }); }}>
    <Field label="Schuldner"><select className={fieldClass} disabled={Boolean(fixedPartyId)} onChange={(event) => setParty(event.target.value)} required value={party}><option value="">Bitte auswählen</option>{options.parties.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select>{fixedPartyId ? <input name="partyId" type="hidden" value={fixedPartyId} /> : null}</Field>
    <Field label="Akte (optional)"><select className={fieldClass} defaultValue={caseId ?? ""} name="caseId"><option value="">Ohne Aktenbezug</option>{matchingCases.map((item) => <option key={item.id} value={item.id}>{item.caseNumber}</option>)}</select></Field>
    <Field label="Anlass"><select className={fieldClass} name="reason"><option value="">Nicht angegeben</option>{Object.entries(reasonLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="Provider"><select className={fieldClass} name="provider" defaultValue="MANUAL"><option value="MANUAL">Manuell</option><option value="MOCK">Mock/Test (keine echte Abfrage)</option></select></Field>
    <Field label="Recherchekosten (optional)"><input className={fieldClass} inputMode="decimal" name="costAmount" placeholder="12,50" pattern="[0-9]+([.,][0-9]{1,2})?" /></Field>
    <Field label="Notiz (optional)"><textarea className={textAreaClass} name="notes" /></Field>
    <div className="flex justify-end gap-2"><Button onClick={onClose} type="button" variant="outline">Abbrechen</Button><Button disabled={busy || !party} type="submit">{busy ? "Wird angelegt …" : "Recherche anlegen"}</Button></div>
  </form></Modal>;
}

function DetailDialog({ item, canManage, busy, onClose, onAddResult, onAction }: { item: AddressResearch; canManage: boolean; busy: boolean; onClose(): void; onAddResult(): void; onAction(run: () => Promise<unknown>, success: string): Promise<void> }) {
  const current = item.party.addresses.find((address) => address.isPrimary) ?? item.party.addresses[0];
  const isOpen = openStatuses.includes(item.status);
  return <Modal title={`Adressermittlung · ${item.party.displayName}`} onClose={onClose} wide>
    <div className="grid gap-4 md:grid-cols-2"><Info label="Status" value={statusLabels[item.status]} /><Info label="Anlass" value={item.reason ? reasonLabels[item.reason] : "—"} /><Info label="Provider" value={item.provider === "MANUAL" ? "Manuell" : "Mock/Test"} /><Info label="Kosten" value={item.costAmount ? `${item.costAmount} ${item.costCurrency}` : "Keine Kosten erfasst"} /><Info label="Ausgangsanschrift" value={formatSnapshot(item)} /><Info label="Aktuelle Anschrift" value={current ? formatAddress(current) : "Keine aktuelle Anschrift"} /></div>
    <div className="mt-6 space-y-3"><h3 className="font-semibold">Rechercheergebnisse</h3>{item.results.map((result) => { const same = current ? addressKey(current) === addressKey(result) : false; return <article className="rounded-xl border p-4" key={result.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{formatAddress(result)}</p><p className="mt-1 text-sm text-muted-foreground">Quelle: {result.source}{result.sourceDate ? ` · ${formatDate(result.sourceDate)}` : ""} · Trefferqualität: {confidenceLabels[result.confidence]}</p>{result.qualityReason ? <p className="mt-2 text-sm">{result.qualityReason}</p> : null}</div>{result.appliedAt ? <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="size-4" /> {same ? "Bestätigt" : "Übernommen"}</span> : canManage && isOpen ? <Button disabled={busy} onClick={() => { if (window.confirm(same ? "Bestehende Anschrift als bestätigt markieren?" : `Neue Anschrift übernehmen?\n\nAktuell: ${current ? formatAddress(current) : "keine"}\nNeu: ${formatAddress(result)}`)) void onAction(() => addressResearchApi.apply(item.id, result.id), same ? "Anschrift wurde bestätigt; es wurde kein Duplikat angelegt." : "Neue Anschrift wurde übernommen; die alte bleibt historisch erhalten."); }}>{same ? "Adresse bestätigen" : "Adresse übernehmen"}</Button> : null}</div></article>; })}{!item.results.length ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Noch kein Ergebnis erfasst.</p> : null}</div>
    {canManage && isOpen ? <div className="mt-6 flex flex-wrap justify-end gap-2">{item.provider === "MOCK" ? <Button disabled={busy} onClick={() => void onAction(() => addressResearchApi.run(item.id), "Mock-Recherche wurde ausgeführt.")} variant="outline"><Search className="size-4" /> Mock-Recherche ausführen</Button> : null}<Button disabled={busy} onClick={onAddResult}><Plus className="size-4" /> Ergebnis erfassen</Button><Button disabled={busy} onClick={() => { if (window.confirm("Recherche ohne Ergebnis abschließen?")) void onAction(() => addressResearchApi.noResult(item.id), "Recherche wurde ohne Ergebnis abgeschlossen."); }} variant="outline">Kein Ergebnis</Button><Button disabled={busy} onClick={() => { const note = window.prompt("Begründung für den Abbruch (optional):") ?? undefined; if (note !== undefined) void onAction(() => addressResearchApi.cancel(item.id, note), "Recherche wurde abgebrochen."); }} variant="outline">Recherche abbrechen</Button></div> : null}
  </Modal>;
}

function ResultDialog({ busy, onClose, onCreate }: { busy: boolean; onClose(): void; onCreate(payload: Parameters<typeof addressResearchApi.addResult>[1]): Promise<void> }) {
  return <Modal title="Rechercheergebnis erfassen" onClose={onClose}><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void onCreate({ street: String(data.get("street")), houseNumber: String(data.get("houseNumber") || "") || undefined, postalCode: String(data.get("postalCode")), city: String(data.get("city")), country: String(data.get("country")), additionalAddressLine: String(data.get("additionalAddressLine") || "") || undefined, source: String(data.get("source")), sourceDate: String(data.get("sourceDate") || "") || undefined, confidence: String(data.get("confidence")) as AddressResearchConfidence, qualityReason: String(data.get("qualityReason") || "") || undefined }); }}>
    <Field label="Straße"><input className={fieldClass} name="street" required /></Field><Field label="Hausnummer"><input className={fieldClass} name="houseNumber" /></Field><Field label="PLZ"><input className={fieldClass} name="postalCode" required /></Field><Field label="Ort"><input className={fieldClass} name="city" required /></Field><Field label="Land"><input className={fieldClass} defaultValue="DE" maxLength={2} name="country" required /></Field><Field label="Adresszusatz"><input className={fieldClass} name="additionalAddressLine" /></Field><Field label="Quelle"><input className={fieldClass} defaultValue="Manuelle Recherche" name="source" required /></Field><Field label="Quelldatum"><input className={fieldClass} name="sourceDate" type="date" /></Field><Field label="Trefferqualität"><select className={fieldClass} defaultValue="MEDIUM" name="confidence">{Object.entries(confidenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="Begründung"><textarea className={textAreaClass} name="qualityReason" /></Field><div className="flex justify-end gap-2 sm:col-span-2"><Button onClick={onClose} type="button" variant="outline">Abbrechen</Button><Button disabled={busy} type="submit">{busy ? "Wird gespeichert …" : "Ergebnis speichern"}</Button></div>
  </form></Modal>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose(): void; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/25 p-4"><div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border bg-background p-6 shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{title}</h2><Button aria-label="Schließen" onClick={onClose} size="icon" variant="ghost"><X className="size-4" /></Button></div>{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("de-DE").format(new Date(value)); }
function formatAddress(value: { street: string; houseNumber: string | null; postalCode: string; city: string; country: string }) { return `${value.street} ${value.houseNumber ?? ""}, ${value.postalCode} ${value.city}, ${value.country}`.replace(/\s+,/, ","); }
function formatSnapshot(item: AddressResearch) { return item.originalStreet && item.originalPostalCode && item.originalCity && item.originalCountry ? formatAddress({ street: item.originalStreet, houseNumber: item.originalHouseNumber, postalCode: item.originalPostalCode, city: item.originalCity, country: item.originalCountry }) : "Keine Ausgangsanschrift"; }
function addressKey(value: { street: string; houseNumber: string | null; postalCode: string; city: string; country: string }) { return [value.street, value.houseNumber ?? "", value.postalCode, value.city, value.country].map((part) => part.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE")).join("|"); }
