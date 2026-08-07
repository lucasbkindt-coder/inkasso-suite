import { FileText } from "lucide-react";

export function CaseDocuments() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3 text-primary">
          <FileText className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Dokumente</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keine Dokumente vorhanden. Die Dokumentenanbindung folgt in einem separaten Sprint.
          </p>
        </div>
      </div>
    </section>
  );
}
