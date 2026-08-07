"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { LedgerResponse, PaymentApplyResponse } from "@/types/case";

import { caseApi } from "./case-api";
import { formatCurrency } from "./case-ui";

const today = () => new Date().toISOString().slice(0, 10);

export function CasePaymentDialog({
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
  const [amount, setAmount] = React.useState("");
  const [bookingDate, setBookingDate] = React.useState(today());
  const [valueDate, setValueDate] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [policy, setPolicy] = React.useState<"BGB_367_DEFAULT" | "CUSTOM">("BGB_367_DEFAULT");
  const [ledger, setLedger] = React.useState<LedgerResponse | null>(null);
  const [manualAmounts, setManualAmounts] = React.useState<Record<string, string>>({});
  const [result, setResult] = React.useState<PaymentApplyResponse | null>(null);
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    if (!open || policy !== "CUSTOM") return;
    void caseApi
      .getLedger(caseId)
      .then(setLedger)
      .catch(() => setError("Offene Positionen konnten nicht geladen werden."));
  }, [caseId, open, policy]);
  const manualAllocations = Object.entries(manualAmounts)
    .filter(([, value]) => value && cents(value) > 0n)
    .map(([targetEntryId, value]) => ({ targetEntryId, amount: value }));
  const assigned = manualAllocations.reduce(
    (sum, allocation) => sum + cents(allocation.amount),
    0n,
  );
  const exceedsPayment = amount ? assigned > cents(amount) : assigned > 0n;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await caseApi.applyPayment(caseId, {
        amount,
        bookingDate,
        valueDate: valueDate || undefined,
        reference: reference || undefined,
        description: description || undefined,
        allocationPolicy: policy,
        allocations: policy === "CUSTOM" ? manualAllocations : undefined,
      });
      setResult(response);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Zahlung konnte nicht erfasst werden.");
    } finally {
      setSaving(false);
    }
  };
  const close = () => {
    setResult(null);
    setAmount("");
    onOpenChange(false);
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-5 flex justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">Zahlung erfassen</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Gesetzliche Reihenfolge nach § 367 BGB: Kosten, Zinsen, Hauptforderung.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          {result ? (
            <PaymentResult result={result} onClose={close} />
          ) : (
            <form className="space-y-4" onSubmit={(event) => void submit(event)}>
              <label className="block text-sm font-medium">
                Betrag
                <input
                  className={inputClass}
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="z. B. 300.00"
                  required
                  value={amount}
                />
              </label>
              <label className="block text-sm font-medium">
                Tilgungsregel
                <select
                  className={inputClass}
                  onChange={(event) =>
                    setPolicy(event.target.value as "BGB_367_DEFAULT" | "CUSTOM")
                  }
                  value={policy}
                >
                  <option value="BGB_367_DEFAULT">Gesetzliche Reihenfolge (§ 367 BGB)</option>
                  <option value="CUSTOM">Manuelle Tilgungsbestimmung</option>
                </select>
              </label>
              {policy === "CUSTOM" ? (
                <ManualAllocations
                  ledger={ledger}
                  amounts={manualAmounts}
                  onChange={setManualAmounts}
                  assigned={assigned}
                  paymentAmount={amount}
                />
              ) : null}
              <label className="block text-sm font-medium">
                Buchungsdatum
                <input
                  className={inputClass}
                  onChange={(event) => setBookingDate(event.target.value)}
                  required
                  type="date"
                  value={bookingDate}
                />
              </label>
              <label className="block text-sm font-medium">
                Wertstellung (optional)
                <input
                  className={inputClass}
                  onChange={(event) => setValueDate(event.target.value)}
                  type="date"
                  value={valueDate}
                />
              </label>
              <label className="block text-sm font-medium">
                Referenz (optional)
                <input
                  className={inputClass}
                  onChange={(event) => setReference(event.target.value)}
                  value={reference}
                />
              </label>
              <label className="block text-sm font-medium">
                Beschreibung (optional)
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
                  onChange={(event) => setDescription(event.target.value)}
                  value={description}
                />
              </label>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={close}>
                  Abbrechen
                </Button>
                <Button disabled={saving || exceedsPayment} type="submit">
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Speichern …
                    </>
                  ) : (
                    "Zahlung verrechnen"
                  )}
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function ManualAllocations({
  ledger,
  amounts,
  onChange,
  assigned,
  paymentAmount,
}: {
  ledger: LedgerResponse | null;
  amounts: Record<string, string>;
  onChange: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  assigned: bigint;
  paymentAmount: string;
}) {
  const targets =
    ledger?.items.filter(
      (entry) =>
        entry.remainingAmount &&
        cents(entry.remainingAmount) > 0n &&
        [
          "PRINCIPAL",
          "INTEREST",
          "COLLECTION_FEE",
          "EXPENSE",
          "COURT_COST",
          "ENFORCEMENT_COST",
        ].includes(entry.type),
    ) ?? [];
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Manuelle Tilgungsbestimmung</p>
      {!ledger ? (
        <p className="text-sm text-muted-foreground">Positionen werden geladen …</p>
      ) : (
        targets.map((entry) => (
          <label className="block border-b pb-3 text-sm last:border-0" key={entry.id}>
            <span className="block font-medium">{entry.description}</span>
            <span className="block text-xs text-muted-foreground">
              Offen: {formatCurrency(entry.remainingAmount ?? "0", entry.currency)}
            </span>
            <input
              className={inputClass}
              inputMode="decimal"
              max={entry.remainingAmount ?? undefined}
              onChange={(event) =>
                onChange((current) => ({ ...current, [entry.id]: event.target.value }))
              }
              placeholder="Zuordnen"
              value={amounts[entry.id] ?? ""}
            />
          </label>
        ))
      )}
      <div className="flex justify-between text-sm">
        <span>Zugeordnet</span>
        <span>{formatCents(assigned)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span>Nicht zugeordnet</span>
        <span>{paymentAmount ? formatCents(cents(paymentAmount) - assigned) : "—"}</span>
      </div>
      {paymentAmount && assigned > cents(paymentAmount) ? (
        <p className="text-sm text-destructive">Die Zuordnung übersteigt den Zahlungsbetrag.</p>
      ) : null}
    </div>
  );
}
function PaymentResult({ result, onClose }: { result: PaymentApplyResponse; onClose: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="font-medium">Die Zahlung wurde wie folgt verrechnet:</p>
        <div className="mt-3 space-y-2 text-sm">
          {result.allocations.map((allocation) => (
            <div
              className="flex justify-between"
              key={`${allocation.targetEntryId}-${allocation.allocationOrder}`}
            >
              <span>{allocation.targetDescription ?? "Forderungsposition"}</span>
              <span>{formatCurrency(allocation.amount, "EUR")}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Nicht zugeordnet</span>
            <span>{formatCurrency(result.unallocatedAmount, "EUR")}</span>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={onClose}>Schließen</Button>
      </div>
    </div>
  );
}
const inputClass = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
function cents(value: string) {
  const [whole = "0", fraction = ""] = value.replace(",", ".").split(".");
  return BigInt(`${whole || "0"}${fraction.padEnd(2, "0").slice(0, 2)}`);
}
function formatCents(value: bigint) {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  return formatCurrency(
    `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`,
    "EUR",
  );
}
