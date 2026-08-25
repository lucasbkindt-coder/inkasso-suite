"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Download, FilePlus2, FileText, Loader2, X, XCircle } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type {
  CaseDocument,
  DocumentDelivery,
  DocumentPreview,
  DocumentTemplate,
} from "@/types/case";

import { caseApi } from "./case-api";
import { formatDate } from "./case-ui";

const documentStatusLabels: Record<CaseDocument["status"], string> = {
  DRAFT: "Entwurf",
  GENERATED: "Erstellt",
  SENT: "Versendet",
  VOIDED: "Ungültig",
};

export function CaseDocuments({ caseId }: { caseId: string }) {
  const [documents, setDocuments] = React.useState<CaseDocument[]>([]);
  const [templates, setTemplates] = React.useState<DocumentTemplate[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [docs, templateValues] = await Promise.all([
        caseApi.getDocuments(caseId),
        caseApi.getDocumentTemplates(),
      ]);
      setDocuments(docs);
      setTemplates(templateValues.filter((template) => template.status === "ACTIVE"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dokumente konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const voidDocument = async (document: CaseDocument) => {
    if (!window.confirm(`Dokument „${document.filename}“ wirklich ungültig machen?`)) return;
    setError("");
    try {
      await caseApi.voidDocument(caseId, document.id);
      await load();
      setSuccess("Das Dokument wurde als ungültig markiert.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Dokument konnte nicht ungültig gemacht werden.",
      );
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-3 text-primary">
            <FileText className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Dokumente</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Versionierte Schreiben der Inkassoakte.
            </p>
          </div>
        </div>
        <Button disabled={loading} onClick={() => setOpen(true)}>
          <FilePlus2 className="size-4" /> Dokument erstellen
        </Button>
      </div>
      <DocumentGenerateDialog
        caseId={caseId}
        onCreated={() => void load()}
        onOpenChange={setOpen}
        open={open}
        templates={templates}
      />
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
      ) : null}
      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Dokumente werden geladen …</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Dokumentname</th>
                <th className="p-3">Typ</th>
                <th className="p-3">Status</th>
                <th className="p-3">Zustellung</th>
                <th className="p-3">Vorlage</th>
                <th className="p-3">Version</th>
                <th className="p-3">Erstellt am</th>
                <th className="p-3">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr className="border-b last:border-0" key={document.id}>
                  <td className="p-3 font-medium">
                    {document.renderedSubject || document.filename}
                  </td>
                  <td className="p-3">{document.type}</td>
                  <td className="p-3">
                    <StatusBadge status={document.status} />
                  </td>
                  <td className="p-3">
                    <DeliveryBadge delivery={document.deliveries?.find((item) => item.channel === "EMAIL")} />
                  </td>
                  <td className="p-3">{document.template?.name ?? "—"}</td>
                  <td className="p-3">
                    {document.templateVersion === null ? "—" : `v${document.templateVersion}`}
                  </td>
                  <td className="p-3 whitespace-nowrap">{formatDate(document.generatedAt)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <a
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      href={caseApi.documentDownloadUrl(caseId, document.id)}
                      target="_blank"
                    >
                      <Download className="size-4" /> Download
                    </a>
                    {document.status !== "VOIDED" ? (
                      <Button
                        className="ml-2"
                        onClick={() => void voidDocument(document)}
                        size="icon"
                        title="Dokument ungültig machen"
                        variant="ghost"
                      >
                        <XCircle className="size-4 text-destructive" />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!documents.length ? (
            <p className="p-4 text-sm text-muted-foreground">Keine Dokumente vorhanden.</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function DocumentGenerateDialog({
  caseId,
  templates,
  open,
  onOpenChange,
  onCreated,
}: {
  caseId: string;
  templates: DocumentTemplate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [templateId, setTemplateId] = React.useState("");
  const [preview, setPreview] = React.useState<DocumentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState("");
  const [paymentDueDate, setPaymentDueDate] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setTemplateId(templates[0]?.id ?? "");
      setPreview(null);
      setError("");
      setPaymentDueDate("");
    }
  }, [open, templates]);
  const selected = templates.find((template) => template.id === templateId);
  const previewDocument = async () => {
    if (!templateId) return;
    setLoadingPreview(true);
    setError("");
    try {
      setPreview(await caseApi.previewDocument(caseId, templateId, paymentDueDate));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vorschau konnte nicht erstellt werden.");
    } finally {
      setLoadingPreview(false);
    }
  };
  const generate = async () => {
    if (!templateId || !preview) return;
    setGenerating(true);
    setError("");
    try {
      await caseApi.generateDocument(caseId, templateId, paymentDueDate);
      onCreated();
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF konnte nicht erzeugt werden.");
    } finally {
      setGenerating(false);
    }
  };
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">Dokument erstellen</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Zuerst Vorschau prüfen, anschließend PDF erzeugen.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button aria-label="Dialog schließen" size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          {!templates.length ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Keine aktiven Dokumentvorlagen verfügbar.
            </p>
          ) : (
            <>
              <label className="mt-6 grid gap-1 text-sm font-medium">
                Vorlage
                <select
                  className="h-10 rounded-lg border bg-background px-3 font-normal"
                  disabled={loadingPreview || generating}
                  onChange={(event) => {
                    setTemplateId(event.target.value);
                    setPreview(null);
                  }}
                  value={templateId}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {template.type} · v{template.version}
                    </option>
                  ))}
                </select>
              </label>
              {selected?.key === "payment-request" || selected?.key === "payment-reminder" || selected?.key === "court-dunning-notice" || selected?.key === "enforcement-notice" ? (
                <label className="mt-4 grid gap-1 text-sm font-medium">
                  Zahlungsfrist
                  <input
                    className="h-10 rounded-lg border bg-background px-3 font-normal"
                    disabled={loadingPreview || generating}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => { setPaymentDueDate(event.target.value); setPreview(null); }}
                    type="date"
                    value={paymentDueDate}
                  />
                </label>
              ) : null}
              <div className="mt-4 flex justify-end">
                <Button
                  disabled={!templateId || loadingPreview || generating}
                  onClick={() => void previewDocument()}
                  variant="outline"
                >
                  {loadingPreview ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Vorschau wird geladen …
                    </>
                  ) : (
                    "Vorschau laden"
                  )}
                </Button>
              </div>
              {preview ? (
                <div className="mt-5 rounded-xl border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    {selected?.name ?? "Vorlage"} · Version {preview.templateVersion}
                  </p>
                  <p className="mt-2 font-semibold">{preview.subject || "Ohne Betreff"}</p>
                  <p className="mt-4 whitespace-pre-line text-sm leading-6">
                    {preview.renderedBody}
                  </p>
                  {preview.warnings?.length ? (
                    <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                      {preview.warnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-5 flex justify-end">
                    <Button disabled={generating || loadingPreview} onClick={() => void generate()}>
                      {generating ? (
                        <>
                          <Loader2 className="size-4 animate-spin" /> PDF wird erzeugt …
                        </>
                      ) : (
                        "PDF erzeugen"
                      )}
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function StatusBadge({ status }: { status: CaseDocument["status"] }) {
  const classes: Record<CaseDocument["status"], string> = {
    DRAFT: "bg-muted text-muted-foreground",
    GENERATED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    SENT: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    VOIDED: "bg-destructive/10 text-destructive",
  };
  const labels: Record<CaseDocument["status"], string> = {
    DRAFT: "Entwurf",
    GENERATED: "Erstellt",
    SENT: "Versendet",
    VOIDED: "Ungültig",
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs ${classes[status]}`}>{labels[status]}</span>
  );
}

function DeliveryBadge({ delivery }: { delivery?: DocumentDelivery }) {
  if (!delivery) return <span className="text-muted-foreground">—</span>;

  const labels: Record<DocumentDelivery["status"], string> = {
    PENDING: "E-Mail ausstehend",
    SENT: "E-Mail protokolliert",
    FAILED: "E-Mail fehlgeschlagen",
    SKIPPED: "Keine E-Mail-Adresse",
  };
  const classes: Record<DocumentDelivery["status"], string> = {
    PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    SENT: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    FAILED: "bg-destructive/10 text-destructive",
    SKIPPED: "bg-muted text-muted-foreground",
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs ${classes[delivery.status]}`} title={delivery.errorMessage ?? undefined}>
      {labels[delivery.status]}
    </span>
  );
}
