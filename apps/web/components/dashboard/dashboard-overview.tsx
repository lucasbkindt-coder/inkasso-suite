"use client";

import {
  CircleDollarSign,
  Clock3,
  FileWarning,
  TrendingUp,
} from "lucide-react";

const cards = [
  {
    title: "Offene Akten",
    value: "148",
    subtitle: "+12 diese Woche",
    icon: FileWarning,
  },
  {
    title: "Forderungsvolumen",
    value: "487.235 €",
    subtitle: "inkl. Gebühren",
    icon: CircleDollarSign,
  },
  {
    title: "Offene Wiedervorlagen",
    value: "18",
    subtitle: "heute fällig",
    icon: Clock3,
  },
  {
    title: "Zahlungseingänge",
    value: "12.487 €",
    subtitle: "heute",
    icon: TrendingUp,
  },
];

export function DashboardOverview() {
  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className="rounded-2xl border bg-card p-6 shadow-sm transition hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {card.title}
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  {card.value}
                </h2>

                <p className="mt-2 text-xs text-muted-foreground">
                  {card.subtitle}
                </p>
              </div>

              <div className="rounded-xl bg-muted p-3">
                <Icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}