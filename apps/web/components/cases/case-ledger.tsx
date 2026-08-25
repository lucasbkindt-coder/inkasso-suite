"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Plus, RotateCcw, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type {
  CreateLedgerEntryInput,
  LedgerEntry,
  LedgerEntryType,
  LedgerResponse,
} from "@/types/case";

import { caseApi } from "./case-api";
import { CaseCostActions } from "./case-cost-dialogs";
import { CasePaymentDialog } from "./case-payment-dialog";
import { formatCurrency, formatDate } from "./case-ui";

const typeLabels: Record<Exclude<LedgerEntryType, "PRINCIPAL">, string> = {
  INTEREST: "Zins",
  COLLECTION_FEE: "Inkassokosten",
  EXPENSE: "Auslage",
  COURT_COST: "Gerichtskosten",
  ENFORCEMENT_COST: "Vollstreckungskosten",
  PAYMENT: "Zahlung",
  CREDIT_NOTE: "Gutschrift",
  CORRECTION: "Korrektur",
  OTHER: "Sonstiges",
};

export function CaseLedger({ caseId }: { caseId: string }) {
  const [ledger, setLedger] = React.useState<LedgerResponse | null>(null);
  const [error, setError] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [paymentOpen, setPaymentOpen] = React.useState(false);
  const load = React.useCallback(async () => {
    try {
      setLedger(await caseApi.getLedger(caseId));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Forderungskonto konnte nicht geladen werden.",
      );
    }
  }, [caseId]);
  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    const openPayment = (event: Event) => {
      if ((event as CustomEvent<string>).detail === "payment") setPaymentOpen(true);
    };
    window.addEventListener("payveo:case-action", openPayment);
    return () => window.removeEventListener("payveo:case-action", openPayment);
  }, []);
  const reverse = async (entry: LedgerEntry) => {
    if (!window.confirm(`Buchung „${entry.description}“ stornieren?`)) return;
    try {
      await caseApi.reverseLedgerEntry(caseId, entry.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Buchung konnte nicht storniert werden.");
    }
  };
  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm" id="ledger">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-semibold">Forderungskonto</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Wirksame Buchungen und Saldo der Inkassoakte.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CaseCostActions caseId={caseId} onApplied={load} />
          <Button onClick={() => setPaymentOpen(true)} variant="outline">
            Zahlung erfassen
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Buchung erfassen
          </Button>
        </div>
      </div>
      <LedgerDialog caseId={caseId} onOpenChange={setOpen} onSaved={load} open={open} />
      <CasePaymentDialog
        caseId={caseId}
        onOpenChange={setPaymentOpen}
        onSaved={load}
        open={paymentOpen}
      />
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {!ledger ? (
        <p className="mt-6 text-sm text-muted-foreground">Forderungskonto wird geladen …</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            <Total
              label="Hauptforderung"
              value={ledger.items
                .filter((entry) => entry.type === "PRINCIPAL")
                .reduce(
                  (total, entry) =>
                    total + (entry.side === "DEBIT" ? cents(entry.amount) : -cents(entry.amount)),
                  0n,
                )
                .toString()
                .replace(/(\d{2})$/, ".$1")}
            />
            <Total label="Offene Kosten" value={ledger.totals.openCosts} />
            <Total label="Offene Zinsen" value={ledger.totals.openInterest} />
            <Total label="Offene Hauptforderung" value={ledger.totals.openPrincipal} />
            <Total emphasis label="Gesamt offen" value={ledger.totals.totalOpen} />
          </div>
          {cents(ledger.totals.unallocatedPayments) > 0n ? (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
              Nicht zugeordnetes Guthaben:{" "}
              {formatCurrency(ledger.totals.unallocatedPayments, "EUR")}
            </p>
          ) : null}
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-3">Datum</th>
                  <th className="px-3 py-3">Buchung</th>
                  <th className="px-3 py-3">Typ</th>
                  <th className="px-3 py-3 text-right">Soll</th>
                  <th className="px-3 py-3 text-right">Haben</th>
                  <th className="px-3 py-3 text-right">Saldo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((entry, index) => {
                  const balance = runningBalance(ledger.items.slice(0, index + 1));
                  return (
                    <tr className="border-b last:border-0" key={entry.id}>
                      <td className="px-3 py-3">{formatDate(entry.bookingDate)}</td>
                      <td className="px-3 py-3">
                        <p
                          className={
                            entry.status === "REVERSED"
                              ? "text-muted-foreground line-through"
                              : "font-medium"
                          }
                        >
                          {entry.description}
                        </p>
                        {entry.status === "REVERSED" ? (
                          <span className="text-xs text-muted-foreground">Storniert</span>
                        ) : null}
                        {entry.remainingAmount !== null && entry.remainingAmount !== undefined ? (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Offen: {formatCurrency(entry.remainingAmount, entry.currency)}
                          </span>
                        ) : null}
                        {entry.type === "PAYMENT" && entry.paymentAllocations?.length ? (
                          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                            <span className="block">Tilgungsverteilung:</span>
                            {entry.paymentAllocations.map((allocation) => (
                              <span
                                className="block"
                                key={`${allocation.targetEntryId}-${allocation.allocationOrder}`}
                              >
                                {allocation.targetEntry?.description ?? "Forderungsposition"}:{" "}
                                {formatCurrency(allocation.amount, entry.currency)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {entry.type === "PRINCIPAL" ? "Hauptforderung" : typeLabels[entry.type]}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {entry.side === "DEBIT"
                          ? formatCurrency(entry.amount, entry.currency)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {entry.side === "CREDIT"
                          ? formatCurrency(entry.amount, entry.currency)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatCents(balance, entry.currency)}
                      </td>
                      <td className="px-3 py-3">
                        {entry.status === "ACTIVE" && !entry.reversedEntryId ? (
                          <Button
                            aria-label="Buchung stornieren"
                            onClick={() => void reverse(entry)}
                            size="icon"
                            variant="ghost"
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Total({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${emphasis ? "text-primary" : ""}`}>
        {formatCurrency(value, "EUR")}
      </p>
    </div>
  );
}
function cents(value: string) {
  const [whole = "0", decimal = ""] = value.replace(/^-/, "").split(".");
  const result = BigInt(`${whole}${decimal.padEnd(2, "0").slice(0, 2)}`);
  return value.startsWith("-") ? -result : result;
}
function runningBalance(entries: LedgerEntry[]) {
  return entries.reduce(
    (balance, entry) =>
      balance + (entry.side === "DEBIT" ? cents(entry.amount) : -cents(entry.amount)),
    0n,
  );
}
function formatCents(value: bigint, currency: string) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return formatCurrency(
    `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`,
    currency,
  );
}

function LedgerDialog({
  caseId,
  open,
  onOpenChange,
  onSaved,
}: {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [type, setType] = React.useState<Exclude<LedgerEntryType, "PRINCIPAL">>("EXPENSE");
  const [amount, setAmount] = React.useState("");
  const [bookingDate, setBookingDate] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [side, setSide] = React.useState<"DEBIT" | "CREDIT">("DEBIT");
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload: CreateLedgerEntryInput = {
        type,
        amount,
        bookingDate,
        description,
        currency: "EUR",
        side: type === "CORRECTION" || type === "OTHER" ? side : undefined,
      };
      await caseApi.createLedgerEntry(caseId, payload);
      await onSaved();
      setAmount("");
      setDescription("");
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Buchung konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };
  const input = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  const freeSide = type === "CORRECTION" || type === "OTHER";
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-5 flex justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">Buchung erfassen</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Manuelle Buchung im Forderungskonto.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <label className="block text-sm font-medium">
              Typ
              <select
                className={input}
                onChange={(event) =>
                  setType(event.target.value as Exclude<LedgerEntryType, "PRINCIPAL">)
                }
                value={type}
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {freeSide ? (
              <label className="block text-sm font-medium">
                Seite
                <select
                  className={input}
                  onChange={(event) => setSide(event.target.value as "DEBIT" | "CREDIT")}
                  value={side}
                >
                  <option value="DEBIT">Soll</option>
                  <option value="CREDIT">Haben</option>
                </select>
              </label>
            ) : null}
            <label className="block text-sm font-medium">
              Betrag
              <input
                className={input}
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="z. B. 25.00"
                required
                value={amount}
              />
            </label>
            <label className="block text-sm font-medium">
              Buchungsdatum
              <input
                className={input}
                onChange={(event) => setBookingDate(event.target.value)}
                required
                type="date"
                value={bookingDate}
              />
            </label>
            <label className="block text-sm font-medium">
              Beschreibung
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
                onChange={(event) => setDescription(event.target.value)}
                required
                value={description}
              />
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-3">
              <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
                Abbrechen
              </Button>
              <Button disabled={saving} type="submit">
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Speichern …
                  </>
                ) : (
                  "Buchen"
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
