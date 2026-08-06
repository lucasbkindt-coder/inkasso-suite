import { ArrowUpRight, CircleDollarSign, FileWarning, Users } from "lucide-react";

const metrics = [
  { label: "Offene Fälle", icon: FileWarning },
  { label: "Forderungsvolumen", icon: CircleDollarSign },
  { label: "Aktive Schuldner", icon: Users },
];

export default function DashboardPage() {
  return (
    <section className="space-y-8">
      <div>
        <p className="text-sm font-medium text-primary">Übersicht</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Ihre zentrale Übersicht für das Forderungsmanagement.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="rounded-xl border bg-card p-5 shadow-sm" key={metric.label}>
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                <div className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              </div>
              <div className="mt-8 h-7 w-20 animate-pulse rounded bg-muted" />
              <p className="mt-2 text-xs text-muted-foreground">Daten werden künftig angezeigt</p>
            </article>
          );
        })}
      </div>

      <article className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <h3 className="font-semibold">Willkommen in der Inkasso Suite</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Das Dashboard-Grundgerüst ist vorbereitet. Kennzahlen, Aktivitäten und Arbeitslisten
              werden in einem späteren Ausbauschritt angebunden.
            </p>
          </div>
          <ArrowUpRight className="size-5 shrink-0 text-muted-foreground" />
        </div>
      </article>
    </section>
  );
}
