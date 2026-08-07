"use client";
import { FileText, Loader2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import type { CaseDocument, DocumentTemplate } from "@/types/case";
import { caseApi } from "./case-api";
import { formatDate } from "./case-ui";

export function CaseDocuments({ caseId }: { caseId: string }) {
  const [documents, setDocuments] = React.useState<CaseDocument[]>([]);
  const [templates, setTemplates] = React.useState<DocumentTemplate[]>([]);
  const [templateId, setTemplateId] = React.useState("");
  const [preview, setPreview] = React.useState<{ subject: string; renderedBody: string } | null>(
    null,
  );
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const load = React.useCallback(async () => {
    const [docs, values] = await Promise.all([
      caseApi.getDocuments(caseId),
      caseApi.getDocumentTemplates(),
    ]);
    setDocuments(docs);
    setTemplates(values);
    if (!templateId && values[0]) setTemplateId(values[0].id);
  }, [caseId, templateId]);
  React.useEffect(() => {
    void load().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Dokumente konnten nicht geladen werden."),
    );
  }, [load]);
  const previewDocument = async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      setPreview(await caseApi.previewDocument(caseId, templateId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vorschau fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };
  const generate = async () => {
    if (!templateId) return;
    setLoading(true);
    try {
      await caseApi.generateDocument(caseId, templateId);
      setPreview(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF konnte nicht erzeugt werden.");
    } finally {
      setLoading(false);
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
        <div className="flex gap-2">
          <select
            className="h-10 rounded-lg border bg-background px-3 text-sm"
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <Button
            disabled={loading || !templateId}
            onClick={() => void previewDocument()}
            variant="outline"
          >
            Vorschau
          </Button>
        </div>
      </div>
      {preview ? (
        <div className="mt-5 rounded-xl border bg-muted/30 p-4">
          <p className="font-medium">{preview.subject}</p>
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {preview.renderedBody}
          </p>
          <div className="mt-4 flex justify-end">
            <Button disabled={loading} onClick={() => void generate()}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Erzeuge …
                </>
              ) : (
                "PDF erzeugen"
              )}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Dokument</th>
              <th className="p-3">Status</th>
              <th className="p-3">Erstellt</th>
              <th className="p-3">Vorlage</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr className="border-b" key={document.id}>
                <td className="p-3 font-medium">{document.renderedSubject ?? document.filename}</td>
                <td className="p-3">{document.status}</td>
                <td className="p-3">{formatDate(document.generatedAt)}</td>
                <td className="p-3">
                  {document.template?.name ?? "—"} · v{document.templateVersion ?? "—"}
                </td>
                <td className="p-3 text-right">
                  <a
                    className="text-primary hover:underline"
                    href={caseApi.documentDownloadUrl(caseId, document.id)}
                    target="_blank"
                  >
                    PDF
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!documents.length ? (
          <p className="p-4 text-sm text-muted-foreground">Keine Dokumente vorhanden.</p>
        ) : null}
      </div>
    </section>
  );
}
