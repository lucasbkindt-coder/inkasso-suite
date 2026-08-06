"use client";

import {
  Calendar,
  CircleDollarSign,
  Clock3,
  FileText,
  Mail,
  Phone,
  User,
} from "lucide-react";

export function CaseDetail() {
  return (
    <div className="space-y-6">

      <div className="rounded-2xl border bg-card p-8 shadow-sm">

        <div className="flex items-start justify-between">

          <div>

            <p className="text-sm text-muted-foreground">
              Inkassoakte
            </p>

            <h1 className="mt-2 text-4xl font-bold">
              0000001/2026
            </h1>

            <div className="mt-4 inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-700">
              Außergerichtlich
            </div>

          </div>

          <CircleDollarSign className="h-12 w-12 text-emerald-500" />

        </div>

      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <div className="rounded-2xl border bg-card p-6 shadow-sm">

          <h2 className="mb-5 text-xl font-semibold">
            Stammdaten
          </h2>

          <div className="space-y-4">

            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Schuldner
                </p>
                <p className="font-medium">
                  Max Mustermann
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Auftraggeber
                </p>
                <p className="font-medium">
                  Muster GmbH
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock3 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Angelegt
                </p>
                <p className="font-medium">
                  05.08.2026
                </p>
              </div>
            </div>

          </div>

        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">

          <h2 className="mb-5 text-xl font-semibold">
            Forderungskonto
          </h2>

          <div className="space-y-4">

            <div className="flex justify-between">
              <span>Hauptforderung</span>
              <strong>1.200,00 €</strong>
            </div>

            <div className="flex justify-between">
              <span>Inkassokosten</span>
              <strong>120,00 €</strong>
            </div>

            <div className="flex justify-between">
              <span>Zinsen</span>
              <strong>62,26 €</strong>
            </div>

            <hr />

            <div className="flex justify-between text-lg font-bold text-emerald-600">
              <span>Gesamtforderung</span>
              <span>1.382,26 €</span>
            </div>

          </div>

        </div>

      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">

        <h2 className="mb-6 text-xl font-semibold">
          Letzte Aktivitäten
        </h2>

        <div className="space-y-4">

          <div>✅ Auftrag angelegt</div>
          <div>📄 Erste Mahnung erstellt</div>
          <div>📧 Schuldner angeschrieben</div>
          <div>💰 Zahlungserinnerung versendet</div>

        </div>

      </div>

      <div className="grid gap-3 sm:grid-cols-4">

        <button className="rounded-xl border p-4 hover:bg-muted transition">
          <FileText className="mx-auto mb-2 h-5 w-5" />
          Dokument
        </button>

        <button className="rounded-xl border p-4 hover:bg-muted transition">
          <CircleDollarSign className="mx-auto mb-2 h-5 w-5" />
          Zahlung
        </button>

        <button className="rounded-xl border p-4 hover:bg-muted transition">
          <Mail className="mx-auto mb-2 h-5 w-5" />
          E-Mail
        </button>

        <button className="rounded-xl border p-4 hover:bg-muted transition">
          <Phone className="mx-auto mb-2 h-5 w-5" />
          Anrufen
        </button>

      </div>

    </div>
  );
}