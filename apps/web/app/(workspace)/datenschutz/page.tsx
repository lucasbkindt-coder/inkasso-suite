"use client";

import * as React from "react";

import { PrivacyCreateDialog } from "@/components/privacy/privacy-create-dialog";
import { PrivacyDetail } from "@/components/privacy/privacy-detail";
import { privacyApi, type PrivacyListItem } from "@/components/privacy/privacy-api";
import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";

const statusLabels: Record<string, string> = { RECEIVED: "Eingegangen", IDENTITY_CHECK: "Identitätsprüfung", IN_REVIEW: "In Prüfung", WAITING_INFORMATION: "Warten auf Informationen", APPROVED: "Genehmigt", PARTIALLY_APPROVED: "Teilweise genehmigt", REJECTED: "Abgelehnt", COMPLETED: "Abgeschlossen", CANCELLED: "Abgebrochen" };
const typeLabels: Record<string, string> = { ACCESS: "Auskunft", ERASURE: "Löschung", RECTIFICATION: "Berichtigung", RESTRICTION: "Einschränkung" };
const selectClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";
const date = (value: string) => new Intl.DateTimeFormat("de-DE").format(new Date(value));
const deadlineLabel = (value: string, status: string) => {
  if (status === "COMPLETED" || status === "CANCELLED") return null;
  const current = new Date();
  const today = Date.UTC(current.getFullYear(), current.getMonth(), current.getDate());
  const due = new Date(value);
  const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const days = Math.round((dueDay - today) / 86_400_000);
  if (days === 0) return "Heute fällig";
  if (days === 1) return "Noch 1 Tag";
  if (days === -1) return "1 Tag überfällig";
  return days > 1 ? `Noch ${days} Tage` : `${Math.abs(days)} Tage überfällig`;
};

export default function PrivacyPage() {
  const [items, setItems] = React.useState<PrivacyListItem[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [type, setType] = React.useState("");
  const [overdue, setOverdue] = React.useState(false);
  const [permissions, setPermissions] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    void privacyApi.list().then(setItems).catch((value: Error) => setError(value.message)).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    void staffAuthApi.session().then((session) => {
      setPermissions(session.permissions);
      if (!session.permissions.includes("privacy:read")) {
        setLoading(false);
        setError("Sie besitzen keine Berechtigung zum Lesen von Datenschutzfällen.");
        return;
      }
      load();
    }).catch((value: Error) => { setLoading(false); setError(value.message); });
  }, [load]);

  const canManage = permissions?.includes("privacy:manage") ?? false;
  const canExport = permissions?.includes("privacy:export") ?? false;
  const shown = items.filter((item) =>
    (!status || item.status === status) &&
    (!type || item.requestType === type) &&
    (!overdue || Boolean(item.dueAt && new Date(item.dueAt) < new Date() && item.status !== "COMPLETED")),
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p><h2 className="text-3xl font-semibold">Datenschutz</h2><p className="mt-1 text-sm text-muted-foreground">Betroffenenanfragen tenantgebunden bearbeiten und dokumentieren.</p></div>
        {canManage ? <Button onClick={() => setCreating(true)}>Datenschutzanfrage anlegen</Button> : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <select className={selectClass} onChange={(event) => setStatus(event.target.value)} value={status}><option value="">Alle Status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={selectClass} onChange={(event) => setType(event.target.value)} value={type}><option value="">Alle Anfragearten</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <Button onClick={() => setOverdue((value) => !value)} variant={overdue ? "default" : "outline"}>Überfällig</Button>
      </div>

      {error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-4">Betroffener</th><th className="p-4">Art</th><th className="p-4">Eingang</th><th className="p-4">Frist</th><th className="p-4">Status</th><th className="p-4">Bearbeiter</th><th className="p-4"><span className="sr-only">Aktion</span></th></tr></thead>
          <tbody>
            {shown.map((item) => { const deadline = item.dueAt ? deadlineLabel(item.dueAt, item.status) : null; return <tr className="border-b last:border-0" key={item.id}><td className="p-4 font-medium">{item.subjectParty?.displayName ?? `${item.clientContact?.firstName ?? ""} ${item.clientContact?.lastName ?? ""}`.trim()}</td><td className="p-4">{typeLabels[item.requestType]}</td><td className="p-4">{date(item.receivedAt)}</td><td className="p-4"><span>{item.dueAt ? date(item.dueAt) : "—"}</span>{deadline ? <span className={deadline.includes("überfällig") ? "block text-xs text-destructive" : "block text-xs text-muted-foreground"}>{deadline}</span> : null}</td><td className="p-4">{statusLabels[item.status]}</td><td className="p-4">{item.assignedMembership?.user.displayName ?? item.assignedMembership?.user.email ?? "—"}</td><td className="p-4 text-right"><Button onClick={() => setSelected(item.id)} variant="outline">Öffnen</Button></td></tr>; })}
            {!loading && !shown.length ? <tr><td className="p-8 text-center text-muted-foreground" colSpan={7}>Keine Datenschutzfälle für die aktuelle Auswahl.</td></tr> : null}
            {loading ? <tr><td className="p-8 text-center text-muted-foreground" colSpan={7}>Datenschutzfälle werden geladen …</td></tr> : null}
          </tbody>
        </table>
      </div>

      {creating ? <PrivacyCreateDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); setSelected(id); }} /> : null}
      {selected ? <PrivacyDetail canExport={canExport} canManage={canManage} id={selected} onChanged={load} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
