"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { CostPreview, InterestCostInput, RvgCostInput, RvgScenario } from "@/types/case";

import { caseApi } from "./case-api";
import { formatCurrency } from "./case-ui";

const inputClass = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
type DialogProps = {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied: () => Promise<void>;
};

export function CaseCostActions({
  caseId,
  onApplied,
}: {
  caseId: string;
  onApplied: () => Promise<void>;
}) {
  const [rvgOpen, setRvgOpen] = React.useState(false);
  const [interestOpen, setInterestOpen] = React.useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setRvgOpen(true)} variant="outline">
          RVG-Kosten berechnen
        </Button>
        <Button onClick={() => setInterestOpen(true)} variant="outline">
          Zinsen berechnen
        </Button>
      </div>
      <RvgDialog caseId={caseId} onApplied={onApplied} onOpenChange={setRvgOpen} open={rvgOpen} />
      <InterestDialog
        caseId={caseId}
        onApplied={onApplied}
        onOpenChange={setInterestOpen}
        open={interestOpen}
      />
    </>
  );
}

function RvgDialog(props: DialogProps) {
  const [payload, setPayload] = React.useState<RvgCostInput>({
    calculationDate: today(),
    scenario: "REGULAR_UNCONTESTED",
    includeExpenseAllowance: true,
    includeVat: false,
  });
  return (
    <CalculationDialog
      {...props}
      title="RVG-Kosten berechnen"
      description="Die Hauptforderung der Akte wird serverseitig als Gegenstandswert verwendet."
      payload={payload}
      preview={(value) => caseApi.previewRvgCosts(props.caseId, value)}
      apply={(value) => caseApi.applyRvgCosts(props.caseId, value)}
      fields={
        <>
          <label className="block text-sm font-medium">
            Berechnungsdatum
            <input
              className={inputClass}
              type="date"
              value={payload.calculationDate}
              onChange={(event) => setPayload({ ...payload, calculationDate: event.target.value })}
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Szenario
            <select
              className={inputClass}
              value={payload.scenario}
              onChange={(event) =>
                setPayload({ ...payload, scenario: event.target.value as RvgScenario })
              }
            >
              <option value="SIMPLE_LETTER">Einfaches Schreiben</option>
              <option value="SIMPLE_CASE">Einfache Angelegenheit</option>
              <option value="REGULAR_UNCONTESTED">Regulär, unstreitig</option>
              <option value="EXTENSIVE_OR_DIFFICULT">Umfangreich oder schwierig</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payload.includeExpenseAllowance}
              onChange={(event) =>
                setPayload({ ...payload, includeExpenseAllowance: event.target.checked })
              }
            />{" "}
            Auslagenpauschale berücksichtigen
          </label>
        </>
      }
    />
  );
}

function InterestDialog(props: DialogProps) {
  const [payload, setPayload] = React.useState<InterestCostInput>({
    mode: "CONSUMER_DEFAULT",
    toDate: today(),
  });
  return (
    <CalculationDialog
      {...props}
      title="Verzugszinsen berechnen"
      description="Der Startzeitpunkt wird ohne Eingabe aus Verzug bzw. Fälligkeit der Forderung bestimmt."
      payload={payload}
      preview={(value) => caseApi.previewInterestCosts(props.caseId, value)}
      apply={(value) => caseApi.applyInterestCosts(props.caseId, value)}
      fields={
        <>
          <label className="block text-sm font-medium">
            Von (optional)
            <input
              className={inputClass}
              type="date"
              value={payload.fromDate ?? ""}
              onChange={(event) =>
                setPayload({ ...payload, fromDate: event.target.value || undefined })
              }
            />
          </label>
          <label className="block text-sm font-medium">
            Bis
            <input
              className={inputClass}
              type="date"
              value={payload.toDate ?? ""}
              onChange={(event) =>
                setPayload({ ...payload, toDate: event.target.value || undefined })
              }
            />
          </label>
          <label className="block text-sm font-medium">
            Zinsart
            <select
              className={inputClass}
              value={payload.mode}
              onChange={(event) =>
                setPayload({ ...payload, mode: event.target.value as InterestCostInput["mode"] })
              }
            >
              <option value="CONSUMER_DEFAULT">Verbrauchergeschäft (+5 Prozentpunkte)</option>
              <option value="COMMERCIAL_DEFAULT">Handelsgeschäft (+9 Prozentpunkte)</option>
              <option value="CUSTOM">Individueller Zinssatz</option>
            </select>
          </label>
          {payload.mode === "CUSTOM" ? (
            <label className="block text-sm font-medium">
              Jahreszinssatz (%)
              <input
                className={inputClass}
                inputMode="decimal"
                value={payload.fixedAnnualRate ?? ""}
                onChange={(event) =>
                  setPayload({ ...payload, fixedAnnualRate: event.target.value })
                }
                required
              />
            </label>
          ) : null}
        </>
      }
    />
  );
}

type CalculationDialogProps<T> = DialogProps & {
  title: string;
  description: string;
  payload: T;
  preview: (payload: T) => Promise<unknown>;
  apply: (payload: T) => Promise<unknown>;
  fields: React.ReactNode;
};
function CalculationDialog<T>({
  open,
  onOpenChange,
  onApplied,
  title,
  description,
  payload,
  preview: getPreview,
  apply,
  fields,
}: CalculationDialogProps<T>) {
  const [preview, setPreview] = React.useState<CostPreview | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const calculate = async () => {
    setLoading(true);
    setError("");
    try {
      setPreview((await getPreview(payload)) as CostPreview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Berechnung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };
  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      await apply(payload);
      await onApplied();
      setPreview(null);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Übernahme fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-5 flex justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="space-y-4">
            {fields}
            {preview ? <Preview preview={preview} /> : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              {preview ? (
                <Button disabled={loading} onClick={() => void submit()}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Übernehmen …
                    </>
                  ) : (
                    "Kosten übernehmen"
                  )}
                </Button>
              ) : (
                <Button disabled={loading} onClick={() => void calculate()}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Berechne …
                    </>
                  ) : (
                    "Vorschau berechnen"
                  )}
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Preview({ preview }: { preview: CostPreview }) {
  const total = preview.totalInterest ?? preview.grossTotal ?? "0.00";
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">Vorschau: {formatCurrency(total, "EUR")}</p>
      {preview.feeNet ? (
        <p className="mt-1 text-muted-foreground">
          Gebühr {formatCurrency(preview.feeNet, "EUR")} · Auslagen{" "}
          {formatCurrency(preview.expenseAllowance ?? "0", "EUR")}
        </p>
      ) : null}
      {preview.periods ? (
        <p className="mt-1 text-muted-foreground">
          {preview.periods.length} Zinsperiode(n), {preview.calculationFrom?.slice(0, 10)} bis{" "}
          {preview.calculationTo?.slice(0, 10)}
        </p>
      ) : null}
    </div>
  );
}
