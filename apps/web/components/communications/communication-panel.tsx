"use client";

import { Download, Mail, Phone, Plus, Upload } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { Communication, CommunicationChannel, CommunicationDirection } from "@/types/communication";
import { communicationApi } from "./communication-api";

const channelLabels: Record<CommunicationChannel, string> = {
  PHONE: "Telefon",
  EMAIL: "E-Mail",
  LETTER: "Brief / Post",
  PORTAL: "Schuldnerportal",
  IN_PERSON: "Persönliches Gespräch",
  OTHER: "Sonstiges",
};

type CaseOption = { id: string; caseNumber: string };

export function CommunicationPanel({ partyId, caseId, cases = [] }: { partyId: string; caseId?: string; cases?: CaseOption[] }) {
  const [items, setItems] = React.useState<Communication[]>([]);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [channel, setChannel] = React.useState<CommunicationChannel | "">("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const load = React.useCallback(async (nextPage = 1, append = false) => {
    setLoading(true);
    try {
      const result = caseId
        ? await communicationApi.listCase(caseId, nextPage, channel || undefined)
        : await communicationApi.listParty(partyId, nextPage, channel || undefined);
      setItems((current) => append ? [...current, ...result.items] : result.items);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Kommunikation konnte nicht geladen werden."); }
    finally { setLoading(false); }
  }, [caseId, channel, partyId]);
  React.useEffect(() => { void load(); }, [load]);
  return <section className="rounded-2xl border bg-card p-6 shadow-sm" id="communication">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Kommunikation</h2><p className="mt-1 text-sm text-muted-foreground">Kontaktvermerke und eingegangene Unterlagen.</p></div><Button onClick={() => setOpen(true)}><Plus className="size-4" /> Kontakt erfassen</Button></div>
    <div className="mt-4 flex flex-wrap gap-2"><select aria-label="Kanal filtern" className="h-9 rounded-lg border bg-background px-2 text-sm" onChange={(event) => setChannel(event.target.value as CommunicationChannel | "")} value={channel}><option value="">Alle Kanäle</option>{(Object.keys(channelLabels) as CommunicationChannel[]).map((value) => <option key={value} value={value}>{channelLabels[value]}</option>)}</select></div>
    {loading ? <p className="mt-5 text-sm text-muted-foreground">Kommunikation wird geladen …</p> : <div className="mt-5 space-y-3">{items.map((item) => <CommunicationRow item={item} key={item.id} />)}{!items.length ? <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">Noch keine Kommunikation erfasst.</p> : null}</div>}
    {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
    {page < totalPages ? <Button className="mt-4" disabled={loading} onClick={() => void load(page + 1, true)} variant="outline">Mehr laden</Button> : null}
    <CommunicationDialog caseId={caseId} cases={cases} onOpenChange={setOpen} onSaved={() => { setOpen(false); void load(); }} open={open} partyId={partyId} />
  </section>;
}

function CommunicationRow({ item }: { item: Communication }) {
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurredAt));
  const person = item.createdByMembership.user.displayName ?? item.createdByMembership.user.email;
  return <article className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{item.direction === "INBOUND" ? "Eingehend" : "Ausgehend"} · {channelLabels[item.channel]}</p><p className="mt-1 text-sm text-muted-foreground">{date}{item.case ? ` · Akte ${item.case.caseNumber}` : " · Allgemeiner Kontakt"} · {person}</p></div></div>{item.subject ? <p className="mt-3 text-sm font-medium">{item.subject}</p> : null}<p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.summary}</p>{item.attachments.length ? <div className="mt-3 flex flex-wrap gap-2">{item.attachments.map((attachment) => <a className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted" href={communicationApi.downloadUrl(item.id, attachment.id)} key={attachment.id}><Download className="size-3" /> {attachment.originalFileName}</a>)}</div> : null}</article>;
}

function CommunicationDialog({ partyId, caseId, cases, open, onOpenChange, onSaved }: { partyId: string; caseId?: string; cases: CaseOption[]; open: boolean; onOpenChange(open: boolean): void; onSaved(): void }) {
  const [direction, setDirection] = React.useState<CommunicationDirection>("INBOUND"); const [channel, setChannel] = React.useState<CommunicationChannel>("PHONE"); const [occurredAt, setOccurredAt] = React.useState(() => localDateTime()); const [selectedCase, setSelectedCase] = React.useState(caseId ?? ""); const [subject, setSubject] = React.useState(""); const [summary, setSummary] = React.useState(""); const [originalMessage, setOriginalMessage] = React.useState<File | null>(null); const [attachments, setAttachments] = React.useState<File[]>([]); const [saving, setSaving] = React.useState(false); const [error, setError] = React.useState("");
  React.useEffect(() => { if (open) { setOccurredAt(localDateTime()); setSelectedCase(caseId ?? ""); setError(""); } }, [caseId, open]);
  if (!open) return null;
  const save = async () => { if (!summary.trim()) { setError("Ein Gesprächsvermerk oder eine Notiz ist erforderlich."); return; } const form = new FormData(); form.set("direction", direction); form.set("channel", channel); form.set("occurredAt", new Date(occurredAt).toISOString()); form.set("summary", summary); if (selectedCase) form.set("caseId", selectedCase); if (subject.trim()) form.set("subject", subject.trim()); if (originalMessage) form.append("originalMessage", originalMessage); attachments.forEach((file) => form.append("attachments", file)); setSaving(true); setError(""); try { await communicationApi.create(partyId, form); onSaved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Kontakt konnte nicht erfasst werden."); } finally { setSaving(false); } };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/25 p-4"><div aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card p-6 shadow-xl" role="dialog"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Kontakt erfassen</h3><p className="mt-1 text-sm text-muted-foreground">Anhänge maximal 10 MB je Datei. EML, PDF, Bilder und Office-Dateien sind zulässig.</p></div><Button disabled={saving} onClick={() => onOpenChange(false)} variant="ghost">Schließen</Button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Richtung"><select className="h-10 rounded-lg border bg-background px-3" disabled={saving} onChange={(event) => setDirection(event.target.value as CommunicationDirection)} value={direction}><option value="INBOUND">Eingehend</option><option value="OUTBOUND">Ausgehend</option></select></Field><Field label="Kontaktart"><select className="h-10 rounded-lg border bg-background px-3" disabled={saving} onChange={(event) => setChannel(event.target.value as CommunicationChannel)} value={channel}>{(Object.keys(channelLabels) as CommunicationChannel[]).map((value) => <option key={value} value={value}>{channelLabels[value]}</option>)}</select></Field><Field label="Datum und Uhrzeit"><input className="h-10 rounded-lg border bg-background px-3" disabled={saving} onChange={(event) => setOccurredAt(event.target.value)} type="datetime-local" value={occurredAt} /></Field>{!caseId ? <Field label="Akte"><select className="h-10 rounded-lg border bg-background px-3" disabled={saving} onChange={(event) => setSelectedCase(event.target.value)} value={selectedCase}><option value="">Nicht zugeordnet</option>{cases.map((item) => <option key={item.id} value={item.id}>{item.caseNumber}</option>)}</select></Field> : null}<Field label="Betreff"><input className="h-10 rounded-lg border bg-background px-3" disabled={saving} onChange={(event) => setSubject(event.target.value)} value={subject} /></Field><label className="grid gap-1 text-sm sm:col-span-2">{channel === "PHONE" ? "Gesprächsvermerk" : "Notiz"}<textarea className="min-h-28 rounded-lg border bg-background p-3" disabled={saving} onChange={(event) => setSummary(event.target.value)} value={summary} /></label>{channel === "EMAIL" ? <label className="grid gap-1 text-sm sm:col-span-2"><span className="inline-flex items-center gap-2"><Mail className="size-4" /> Original-E-Mail (.eml)</span><input accept=".eml,message/rfc822" disabled={saving} onChange={(event) => setOriginalMessage(event.target.files?.[0] ?? null)} type="file" /></label> : null}<label className="grid gap-1 text-sm sm:col-span-2"><span className="inline-flex items-center gap-2"><Upload className="size-4" /> {channel === "LETTER" ? "Briefscan hinzufügen" : "Anhänge hinzufügen"}</span><input accept=".eml,.pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" disabled={saving} multiple onChange={(event) => setAttachments(Array.from(event.target.files ?? []))} type="file" /></label></div>{error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}<div className="mt-6 flex justify-end gap-2"><Button disabled={saving} onClick={() => onOpenChange(false)} variant="outline">Abbrechen</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Speichert …" : "Kontakt speichern"}</Button></div></div></div>;
}

function Field({ children, label }: { children: React.ReactNode; label: string }) { return <label className="grid gap-1 text-sm">{label}{children}</label>; }
function localDateTime() { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); }
