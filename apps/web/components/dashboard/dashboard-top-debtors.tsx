import { ArrowUpRight } from "lucide-react";

const debtors = [
  {
    id: 1,
    name: "Müller GmbH",
    amount: "18.250,00 €",
    cases: 4,
  },
  {
    id: 2,
    name: "Schmidt Logistik",
    amount: "12.870,00 €",
    cases: 2,
  },
  {
    id: 3,
    name: "Autohaus Weber",
    amount: "9.430,00 €",
    cases: 3,
  },
  {
    id: 4,
    name: "Max Mustermann",
    amount: "7.210,00 €",
    cases: 1,
  },
];

export function DashboardTopDebtors() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Höchste Forderungen</h2>

          <p className="text-sm text-muted-foreground">
            Schuldner mit den höchsten offenen Forderungen
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {debtors.map((debtor) => (
          <div
            key={debtor.id}
            className="flex items-center justify-between rounded-xl border p-4 hover:bg-muted/40 transition"
          >
            <div>
              <h3 className="font-medium">{debtor.name}</h3>

              <p className="text-sm text-muted-foreground">{debtor.cases} Akten</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-bold text-red-600">{debtor.amount}</span>

              <button className="rounded-lg border p-2 hover:bg-muted" type="button">
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
