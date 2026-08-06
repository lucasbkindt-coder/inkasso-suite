"use client";

import { Plus } from "lucide-react";

export function NewCaseDialog() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Neue Inkassoakte
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Erfassung eines neuen Inkassofalls
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-primary-foreground">
          <Plus className="h-4 w-4" />
          Neue Akte
        </button>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border p-5">
          <p className="text-xs uppercase text-muted-foreground">
            Auftraggeber
          </p>

          <p className="mt-2 font-medium">
            Muster GmbH
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <p className="text-xs uppercase text-muted-foreground">
            Schuldner
          </p>

          <p className="mt-2 font-medium">
            Max Mustermann
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <p className="text-xs uppercase text-muted-foreground">
            Hauptforderung
          </p>

          <p className="mt-2 text-2xl font-bold">
            1.248,53 €
          </p>
        </div>

        <div className="rounded-xl border p-5">
          <p className="text-xs uppercase text-muted-foreground">
            Automatische Gebühren
          </p>

          <p className="mt-2 text-2xl font-bold">
            98,00 €
          </p>
        </div>
      </div>
    </div>
  );
}