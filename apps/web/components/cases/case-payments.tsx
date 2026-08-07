"use client";

import { Plus, Wallet } from "lucide-react";

const payments = [
  {
    id: 1,
    date: "01.08.2026",
    amount: "250,00 €",
    type: "Teilzahlung",
  },
  {
    id: 2,
    date: "18.07.2026",
    amount: "500,00 €",
    type: "Überweisung",
  },
];

export function CasePayments() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-lg">

      <div className="flex items-center justify-between">

        <div>

          <h2 className="text-xl font-semibold">
            Forderungskonto
          </h2>

          <p className="text-sm text-muted-foreground">
            Übersicht aller Zahlungseingänge
          </p>

        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Zahlung erfassen
        </button>

      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Ursprungsforderung
          </p>

          <h3 className="mt-2 text-2xl font-bold">
            4.825,60 €
          </h3>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Bereits bezahlt
          </p>

          <h3 className="mt-2 text-2xl font-bold text-emerald-600">
            750,00 €
          </h3>
        </div>

        <div className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">
            Restforderung
          </p>

          <h3 className="mt-2 text-2xl font-bold text-red-600">
            4.075,60 €
          </h3>
        </div>

      </div>

      <div className="mt-6 space-y-3">

        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/40"
          >
            <div className="flex items-center gap-3">

              <div className="rounded-full bg-emerald-100 p-3">
                <Wallet className="h-5 w-5 text-emerald-600" />
              </div>

              <div>

                <p className="font-medium">
                  {payment.type}
                </p>

                <p className="text-sm text-muted-foreground">
                  {payment.date}
                </p>

              </div>

            </div>

            <span className="font-bold text-emerald-600">
              {payment.amount}
            </span>

          </div>
        ))}

      </div>

    </section>
  );
}