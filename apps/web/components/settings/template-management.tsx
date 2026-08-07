"use client";

import * as React from "react";
import { Archive, Copy, Eye, FilePlus2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { caseApi } from "@/components/cases/case-api";
import type { DocumentTemplate, DocumentTemplateInput, DocumentType } from "@/types/case";
import { TemplatePreviewDialog } from "./template-preview-dialog";

const documentTypes: { value: DocumentType; label: string }[] = [
  { value: "PAYMENT_REQUEST", label: "Zahlungsaufforderung" },
  { value: "SECOND_PAYMENT_REQUEST", label: "Zweite Zahlungsaufforderung" },
  { value: "JUDICIAL_DUNNING_NOTICE", label: "Gerichtliches Mahnschreiben" },
  { value: "ENFORCEMENT_NOTICE", label: "Vollstreckungsschreiben" },
  { value: "PAYMENT_PLAN", label: "Ratenzahlungsvereinbarung" },
  { value: "CUSTOM", label: "Individuelles Schreiben" },
];
const placeholders = [
  ["Akte", "Aktenzeichen", "{{case.caseNumber}}"],
  ["Auftraggeber", "Name", "{{client.displayName}}"],
  ["Schuldner", "Name", "{{debtor.displayName}}"],
  ["Forderung", "Rechnungsnummer", "{{claim.invoiceNumber}}"],
  ["Forderungskonto", "Offener Gesamtbetrag", "{{ledger.total}}"],
  ["Unternehmensdaten", "IBAN", "{{company.iban}}"],
  ["Zahlungsinformationen", "Verwendungszweck", "{{payment.reference}}"],
  ["Datum", "Heutiges Datum", "{{date.today}}"],
] as const;
const emptyTemplate: DocumentTemplateInput = {
  name: "",
  key: "",
  type: "CUSTOM",
  subject: "",
  bodyTemplate: "",
};

function typeLabel(type: string) {
  return documentTypes.find((item) => item.value === type)?.label ?? type;
}
function asInput(template: DocumentTemplate): DocumentTemplateInput {
  return {
    name: template.name,
    key: template.key,
    type: template.type as DocumentType,
    subject: template.subject ?? "",
    bodyTemplate: template.bodyTemplate,
  };
}

export function TemplateManagement() {
  const [templates, setTemplates] = React.useState<DocumentTemplate[]>([]);
  const [selected, setSelected] = React.useState<DocumentTemplate | null>(null);
  const [values, setValues] = React.useState<DocumentTemplateInput>(emptyTemplate);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    const templateValues = await caseApi.getDocumentTemplates(true);
    setTemplates(templateValues);
  }, []);
  React.useEffect(() => {
    void load()
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Vorlagen konnten nicht geladen werden."),
      )
      .finally(() => setLoading(false));
  }, [load]);

  const edit = (template: DocumentTemplate) => {
    setSelected(template);
    setValues(asInput(template));
    setError("");
    setMessage("");
  };
  const newTemplate = () => {
    setSelected(null);
    setValues(emptyTemplate);
    setError("");
    setMessage("");
  };
  const update = <K extends keyof DocumentTemplateInput>(key: K, value: DocumentTemplateInput[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const save = async (asVersion: boolean) => {
    if (!values.name || !values.key || !values.bodyTemplate) {
      setError("Bitte füllen Sie Name, Key und Textvorlage aus.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...values, subject: values.subject || undefined };
      const saved = selected
        ? await caseApi.createDocumentTemplateVersion(selected.id, payload)
        : await caseApi.createDocumentTemplate(payload);
      setSelected(saved);
      setValues(asInput(saved));
      setMessage(
        asVersion || selected ? "Neue Vorlagenversion wurde angelegt." : "Vorlage wurde angelegt.",
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vorlage konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };
  const archive = async (template = selected) => {
    if (!template || !window.confirm(`Vorlage „${template.name}“ archivieren?`)) return;
    setSaving(true);
    setError("");
    try {
      await caseApi.archiveDocumentTemplate(template.id);
      newTemplate();
      await load();
      setMessage("Vorlage wurde archiviert.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vorlage konnte nicht archiviert werden.");
    } finally {
      setSaving(false);
    }
  };
  const copy = async (placeholder: string) => {
    try {
      await navigator.clipboard.writeText(placeholder);
      setMessage(`${placeholder} wurde kopiert.`);
    } catch {
      setError("Platzhalter konnte nicht in die Zwischenablage kopiert werden.");
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Dokumentvorlagen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Versionierte Vorlagen für Schreiben im Arbeitsbereich.
          </p>
        </div>
        <Button onClick={newTemplate}>
          <FilePlus2 className="size-4" /> Neue Vorlage
        </Button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Vorlagen werden geladen …</p> : null}
      {!loading ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Typ</th>
                  <th className="p-3">Key</th>
                  <th className="p-3">Version</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Geändert</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr className="border-b" key={template.id}>
                    <td className="p-3 font-medium">{template.name}</td>
                    <td className="p-3">{typeLabel(template.type)}</td>
                    <td className="p-3 font-mono text-xs">{template.key}</td>
                    <td className="p-3">v{template.version}</td>
                    <td className="p-3">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                        {template.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {new Intl.DateTimeFormat("de-DE").format(new Date(template.updatedAt))}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button
                        onClick={() => edit(template)}
                        size="icon"
                        title="Vorlage öffnen"
                        variant="ghost"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        disabled={template.status === "ARCHIVED"}
                        onClick={() => edit(template)}
                        size="icon"
                        title="Neue Version anlegen"
                        variant="ghost"
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        disabled={template.status === "ARCHIVED" || saving}
                        onClick={() => void archive(template)}
                        size="icon"
                        title="Vorlage archivieren"
                        variant="ghost"
                      >
                        <Archive className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!templates.length ? (
              <p className="p-4 text-sm text-muted-foreground">Keine Dokumentvorlagen vorhanden.</p>
            ) : null}
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <h3 className="font-semibold">
              {selected ? `${selected.name} · v${selected.version}` : "Neue Dokumentvorlage"}
            </h3>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-sm font-medium">
                Name
                <input
                  className="h-10 rounded-lg border bg-background px-3 font-normal"
                  value={values.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Key
                <input
                  className="h-10 rounded-lg border bg-background px-3 font-mono text-xs font-normal"
                  disabled={Boolean(selected)}
                  value={values.key}
                  onChange={(event) => update("key", event.target.value.toLowerCase())}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Typ
                <select
                  className="h-10 rounded-lg border bg-background px-3 font-normal"
                  value={values.type}
                  onChange={(event) => update("type", event.target.value as DocumentType)}
                >
                  {documentTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Betreff
                <input
                  className="h-10 rounded-lg border bg-background px-3 font-normal"
                  value={values.subject ?? ""}
                  onChange={(event) => update("subject", event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Textvorlage
                <textarea
                  className="min-h-48 rounded-lg border bg-background p-3 font-mono text-xs font-normal"
                  value={values.bodyTemplate}
                  onChange={(event) => update("bodyTemplate", event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button disabled={saving} onClick={() => void save(Boolean(selected))}>
                {selected ? "Neue Version speichern" : "Vorlage anlegen"}
              </Button>
              {selected ? (
                <>
                  <Button
                    disabled={saving || selected.status !== "ACTIVE"}
                    onClick={() => setPreviewOpen(true)}
                    variant="outline"
                  >
                    <Eye className="size-4" /> Vorschau mit Akte
                  </Button>
                  <Button disabled={saving} onClick={() => void archive()} variant="outline">
                    <Archive className="size-4" /> Archivieren
                  </Button>
                </>
              ) : null}
            </div>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            {message ? (
              <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="mt-6 rounded-xl border bg-muted/30 p-4">
        <h3 className="font-semibold">Verfügbare Platzhalter</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {placeholders.map(([group, label, value]) => (
            <button
              className="rounded-lg border bg-background p-3 text-left text-xs hover:bg-accent"
              key={value}
              onClick={() => void copy(value)}
              type="button"
            >
              <span className="block text-muted-foreground">
                {group} · {label}
              </span>
              <span className="mt-1 flex items-center gap-1 font-mono">
                <Copy className="size-3" /> {value}
              </span>
            </button>
          ))}
        </div>
      </div>
      <TemplatePreviewDialog onOpenChange={setPreviewOpen} open={previewOpen} template={selected} />
    </section>
  );
}
