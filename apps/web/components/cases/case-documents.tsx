"use client";

import {
  Download,
  Eye,
  FileText,
  Upload,
} from "lucide-react";

const documents = [
  {
    id: 1,
    name: "Forderungsaufstellung.pdf",
    type: "PDF",
    date: "07.08.2026",
  },
  {
    id: 2,
    name: "Mahnung_1.pdf",
    type: "PDF",
    date: "09.08.2026",
  },
  {
    id: 3,
    name: "Zahlungsvereinbarung.pdf",
    type: "PDF",
    date: "12.08.2026",
  },
];

export function CaseDocuments() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-lg">

      <div className="mb-6 flex items-center justify-between">

        <h2 className="text-xl font-semibold">
          Dokumente
        </h2>

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Upload className="h-4 w-4" />
          Hochladen
        </button>

      </div>

      <div className="space-y-3">

        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/40 transition"
          >
            <div className="flex items-center gap-3">

              <div className="rounded-lg bg-primary/10 p-3">
                <FileText className="h-5 w-5 text-primary" />
              </div>

              <div>

                <p className="font-medium">
                  {doc.name}
                </p>

                <p className="text-sm text-muted-foreground">
                  {doc.type} • {doc.date}
                </p>

              </div>

            </div>

            <div className="flex gap-2">

              <button
                type="button"
                className="rounded-lg border p-2 hover:bg-muted"
                title="Anzeigen"
              >
                <Eye className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="rounded-lg border p-2 hover:bg-muted"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>

            </div>

          </div>
        ))}

      </div>

    </section>
  );
}