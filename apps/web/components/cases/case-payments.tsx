import { Wallet } from "lucide-react";

export function CasePayments() {
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-3 text-primary">
          <Wallet className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Zahlungen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Keine Zahlungen erfasst. Das Forderungskonto ist noch nicht angebunden.
          </p>
        </div>
      </div>
    </section>
  );
}
