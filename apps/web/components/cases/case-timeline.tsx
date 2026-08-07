"use client";

import {
  Clock3,
  FileText,
  Mail,
  Wallet,
} from "lucide-react";

const entries = [
  {
    icon: Mail,
    title: "Erste Mahnung versendet",
    time: "Heute · 09:15",
  },
  {
    icon: Wallet,
    title: "Teilzahlung eingegangen",
    time: "Gestern · 14:02",
  },
  {
    icon: FileText,
    title: "Forderung angelegt",
    time: "15.03.2026",
  },
];

export function CaseTimeline() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-lg">

      <div className="mb-6 flex items-center gap-2">

        <Clock3 className="h-5 w-5 text-primary" />

        <h2 className="text-xl font-semibold">
          Aktivitäten
        </h2>

      </div>

      <div className="space-y-5">

        {entries.map((entry) => {
          const Icon = entry.icon;

          return (
            <div
              key={entry.title}
              className="flex gap-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>

              <div>

                <p className="font-medium">
                  {entry.title}
                </p>

                <p className="text-sm text-muted-foreground">
                  {entry.time}
                </p>

              </div>

            </div>
          );
        })}

      </div>

    </section>
  );
}