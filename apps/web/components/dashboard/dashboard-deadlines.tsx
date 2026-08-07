import { CalendarClock, ChevronRight } from "lucide-react";

const deadlines = [
  { title: "Wiedervorlage prüfen", caseNumber: "AKT-2026-000142", due: "Heute, 10:30" },
  { title: "Ratenzahlung abstimmen", caseNumber: "AKT-2026-000117", due: "Heute, 14:00" },
  { title: "Mahnlauf freigeben", caseNumber: "AKT-2026-000088", due: "Morgen, 09:00" },
];

export function DashboardDeadlines() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Wiedervorlagen</h2>
          <p className="text-sm text-muted-foreground">Nächste Fristen im Arbeitsbereich</p>
        </div>
        <CalendarClock className="size-5 text-primary" />
      </div>
      <div className="space-y-2">
        {deadlines.map((deadline) => (
          <div className="flex items-center gap-3 rounded-xl border p-3" key={deadline.caseNumber}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{deadline.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{deadline.caseNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-primary">{deadline.due}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        ))}
      </div>
    </section>
  );
}
