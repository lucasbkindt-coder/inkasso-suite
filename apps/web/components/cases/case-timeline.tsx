import { Clock3 } from "lucide-react";

export function CaseTimeline() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3 text-primary">
          <Clock3 className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Aktivitäten</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keine Aktivitäten vorhanden. Die Historie wird in einem separaten Sprint angebunden.
          </p>
        </div>
      </div>
    </section>
  );
}
