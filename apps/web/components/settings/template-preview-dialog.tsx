"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Eye, Loader2, Search, X } from "lucide-react";
import * as React from "react";

import { caseApi } from "@/components/cases/case-api";
import { Button } from "@/components/ui/button";
import type { Case, DocumentPreview, DocumentTemplate } from "@/types/case";

export function TemplatePreviewDialog({
  template,
  open,
  onOpenChange,
}: {
  template: DocumentTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [cases, setCases] = React.useState<Case[]>([]);
  const [caseId, setCaseId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [loadingCases, setLoadingCases] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [preview, setPreview] = React.useState<DocumentPreview | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setLoadingCases(true);
    setError("");
    setPreview(null);
    void caseApi
      .getCases({ pageSize: 100 })
      .then((response) => {
        setCases(response.items);
        setCaseId((current) => current || response.items[0]?.id || "");
      })
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Inkassoakten konnten nicht geladen werden.",
        ),
      )
      .finally(() => setLoadingCases(false));
  }, [open]);

  const selectedCase = cases.find((item) => item.id === caseId);
  const filteredCases = cases.filter((item) => {
    const term = search.toLocaleLowerCase("de-DE");
    return [item.caseNumber, item.clientParty.displayName, item.debtorParty.displayName].some(
      (value) => value.toLocaleLowerCase("de-DE").includes(term),
    );
  });
  const createPreview = async () => {
    if (!template || !caseId) return;
    setLoadingPreview(true);
    setError("");
    try {
      setPreview(await caseApi.previewDocument(caseId, template.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vorschau konnte nicht erstellt werden.");
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Vorschau mit Akte</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {template ? `${template.name} · Version ${template.version}` : "Vorlage auswählen"}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button aria-label="Dialog schließen" size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-3">
              <label className="relative block">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Aktenzeichen oder Partei suchen"
                  value={search}
                />
              </label>
              {loadingCases ? (
                <p className="text-sm text-muted-foreground">Akten werden geladen …</p>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-xl border">
                  {filteredCases.map((item) => (
                    <button
                      className={`block w-full border-b p-3 text-left text-sm last:border-0 ${caseId === item.id ? "bg-primary/10" : "hover:bg-muted"}`}
                      key={item.id}
                      onClick={() => {
                        setCaseId(item.id);
                        setPreview(null);
                      }}
                      type="button"
                    >
                      <span className="font-medium">{item.caseNumber}</span>
                      <span className="mt-1 block text-muted-foreground">
                        {item.clientParty.displayName} · {item.debtorParty.displayName}
                      </span>
                    </button>
                  ))}
                  {!filteredCases.length ? (
                    <p className="p-3 text-sm text-muted-foreground">
                      Keine passenden Inkassoakten.
                    </p>
                  ) : null}
                </div>
              )}
              <Button
                disabled={!caseId || loadingCases || loadingPreview || !template}
                onClick={() => void createPreview()}
              >
                <Eye className="size-4" />
                {loadingPreview ? "Vorschau wird erstellt …" : "Vorschau erstellen"}
              </Button>
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              {preview ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {selectedCase?.caseNumber ?? "Inkassoakte"}
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
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Wählen Sie eine Inkassoakte und erstellen Sie eine Vorschau. Es wird kein Dokument
                  erzeugt.
                </p>
              )}
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
