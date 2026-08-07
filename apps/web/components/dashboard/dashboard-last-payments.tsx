import { ArrowUpRight } from "lucide-react";
import { mockPayments } from "@/lib/mock/payments";

export function DashboardLastPayments() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Letzte Zahlungen</h2>
          <p className="text-sm text-muted-foreground">Kürzlich erfasste Zahlungseingänge</p>
        </div>
        <ArrowUpRight className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-3">
        {mockPayments.map((payment) => (
          <div className="flex items-center justify-between rounded-xl border p-4" key={payment.id}>
            <div>
              <p className="text-sm font-medium">{payment.reference}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {payment.bookingDate} · {payment.type}
              </p>
            </div>
            <p className="font-semibold text-emerald-600">
              {payment.amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
