export function DashboardChart() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Zahlungseingänge</h2>

          <p className="text-sm text-muted-foreground">Letzte 30 Tage</p>
        </div>
      </div>

      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed">
        <div className="text-center">
          <p className="text-lg font-semibold">Diagramm</p>

          <p className="mt-2 text-sm text-muted-foreground">
            Recharts wird im nächsten Sprint integriert.
          </p>
        </div>
      </div>
    </section>
  );
}
