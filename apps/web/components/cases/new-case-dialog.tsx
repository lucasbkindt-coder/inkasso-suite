"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import type { CasePriority } from "@/types/case";

import { caseApi, type PartyOption } from "./case-api";
import { casePriorityLabels } from "./case-ui";

const schema = z
  .object({
    clientPartyId: z.string().uuid("Bitte einen Auftraggeber auswählen."),
    debtorPartyId: z.string().uuid("Bitte einen Schuldner auswählen."),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
    invoiceNumber: z.string().trim().min(1, "Rechnungsnummer ist erforderlich."),
    invoiceDate: z.string().min(1, "Rechnungsdatum ist erforderlich."),
    dueDate: z.string().min(1, "Fälligkeitsdatum ist erforderlich."),
    defaultDate: z.string().optional(),
    principalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Bitte einen gültigen Betrag eingeben."),
    currency: z.string().length(3),
    description: z.string().max(4000).optional(),
    internalNotes: z.string().max(10000).optional(),
  })
  .superRefine((values, context) => {
    if (values.dueDate && values.invoiceDate && values.dueDate < values.invoiceDate)
      context.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Fälligkeit darf nicht vor dem Rechnungsdatum liegen.",
      });
    if (values.defaultDate && values.dueDate && values.defaultDate < values.dueDate)
      context.addIssue({
        code: "custom",
        path: ["defaultDate"],
        message: "Verzugsdatum darf nicht vor der Fälligkeit liegen.",
      });
  });

type Values = z.infer<typeof schema>;

export function NewCaseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [clients, setClients] = React.useState<PartyOption[]>([]);
  const [debtors, setDebtors] = React.useState<PartyOption[]>([]);
  const [clientSearch, setClientSearch] = React.useState("");
  const [debtorSearch, setDebtorSearch] = React.useState("");
  const [partyError, setPartyError] = React.useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: "NORMAL",
      currency: "EUR",
      principalAmount: "",
      invoiceNumber: "",
      invoiceDate: "",
      dueDate: "",
      defaultDate: "",
      description: "",
      internalNotes: "",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    void Promise.all([caseApi.getParties("CLIENT"), caseApi.getParties("DEBTOR")])
      .then(([clientResponse, debtorResponse]) => {
        setClients(clientResponse.items);
        setDebtors(debtorResponse.items);
        setPartyError("");
      })
      .catch((cause) =>
        setPartyError(
          cause instanceof Error ? cause.message : "Parteien konnten nicht geladen werden.",
        ),
      );
  }, [open]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const created = await caseApi.createCase({
        clientPartyId: values.clientPartyId,
        debtorPartyId: values.debtorPartyId,
        priority: values.priority as CasePriority,
        internalNotes: values.internalNotes || undefined,
        claim: {
          invoiceNumber: values.invoiceNumber,
          invoiceDate: values.invoiceDate,
          dueDate: values.dueDate,
          defaultDate: values.defaultDate || undefined,
          principalAmount: values.principalAmount,
          currency: values.currency.toUpperCase(),
          description: values.description || undefined,
        },
      });
      form.reset();
      onOpenChange(false);
      onCreated();
      router.push(`/akten/${created.id}`);
    } catch (cause) {
      form.setError("root", {
        message: cause instanceof Error ? cause.message : "Akte konnte nicht angelegt werden.",
      });
    }
  });
  const input = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  const saving = form.formState.isSubmitting;
  const matchingClients = clients.filter((party) =>
    party.displayName.toLocaleLowerCase("de-DE").includes(clientSearch.toLocaleLowerCase("de-DE")),
  );
  const matchingDebtors = debtors.filter((party) =>
    party.displayName.toLocaleLowerCase("de-DE").includes(debtorSearch.toLocaleLowerCase("de-DE")),
  );
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Neue Inkassoakte</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Aktenzeichen wird nach dem Speichern serverseitig vergeben.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button aria-label="Dialog schließen" size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <form className="space-y-5" onSubmit={submit}>
            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-2 font-medium">Beteiligte Parteien</legend>
              <SelectField
                error={form.formState.errors.clientPartyId?.message}
                label="Auftraggeber"
              >
                <input
                  className={input}
                  disabled={saving}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Auftraggeber suchen"
                  value={clientSearch}
                />
                <select className={input} disabled={saving} {...form.register("clientPartyId")}>
                  <option value="">Auftraggeber auswählen</option>
                  {matchingClients.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.displayName}
                    </option>
                  ))}
                </select>
              </SelectField>
              <SelectField error={form.formState.errors.debtorPartyId?.message} label="Schuldner">
                <input
                  className={input}
                  disabled={saving}
                  onChange={(event) => setDebtorSearch(event.target.value)}
                  placeholder="Schuldner suchen"
                  value={debtorSearch}
                />
                <select className={input} disabled={saving} {...form.register("debtorPartyId")}>
                  <option value="">Schuldner auswählen</option>
                  {matchingDebtors.map((party) => (
                    <option key={party.id} value={party.id}>
                      {party.displayName}
                    </option>
                  ))}
                </select>
              </SelectField>
            </fieldset>
            {partyError ? <p className="text-sm text-destructive">{partyError}</p> : null}
            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-2 font-medium md:col-span-2">Forderung</legend>
              <SelectField
                error={form.formState.errors.invoiceNumber?.message}
                label="Rechnungsnummer"
              >
                <input className={input} disabled={saving} {...form.register("invoiceNumber")} />
              </SelectField>
              <SelectField
                error={form.formState.errors.principalAmount?.message}
                label="Hauptforderung"
              >
                <input
                  className={input}
                  disabled={saving}
                  inputMode="decimal"
                  placeholder="z. B. 1248.53"
                  {...form.register("principalAmount")}
                />
              </SelectField>
              <SelectField
                error={form.formState.errors.invoiceDate?.message}
                label="Rechnungsdatum"
              >
                <input
                  className={input}
                  disabled={saving}
                  type="date"
                  {...form.register("invoiceDate")}
                />
              </SelectField>
              <SelectField error={form.formState.errors.dueDate?.message} label="Fälligkeitsdatum">
                <input
                  className={input}
                  disabled={saving}
                  type="date"
                  {...form.register("dueDate")}
                />
              </SelectField>
              <SelectField error={form.formState.errors.defaultDate?.message} label="Verzugsdatum">
                <input
                  className={input}
                  disabled={saving}
                  type="date"
                  {...form.register("defaultDate")}
                />
              </SelectField>
              <SelectField label="Währung">
                <input
                  className={input}
                  disabled={saving}
                  maxLength={3}
                  {...form.register("currency")}
                />
              </SelectField>
              <SelectField label="Beschreibung">
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
                  disabled={saving}
                  {...form.register("description")}
                />
              </SelectField>
            </fieldset>
            <fieldset className="grid gap-4 md:grid-cols-2">
              <legend className="mb-2 font-medium md:col-span-2">Akte</legend>
              <SelectField label="Priorität">
                <select className={input} disabled={saving} {...form.register("priority")}>
                  {Object.entries(casePriorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </SelectField>
              <SelectField label="Interne Notiz">
                <textarea
                  className="mt-1 min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
                  disabled={saving}
                  {...form.register("internalNotes")}
                />
              </SelectField>
            </fieldset>
            {form.formState.errors.root ? (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            ) : null}
            <div className="flex justify-end gap-3">
              <Button
                disabled={saving}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="outline"
              >
                Abbrechen
              </Button>
              <Button disabled={saving || Boolean(partyError)} type="submit">
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Speichern …
                  </>
                ) : (
                  "Inkassoakte anlegen"
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SelectField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-normal text-destructive">{error}</span>
      ) : null}
    </label>
  );
}
