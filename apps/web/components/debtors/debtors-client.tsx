"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import * as Dialog from "@radix-ui/react-dialog";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";

type Debtor = {
  id: string;
  type: "PERSON" | "COMPANY";
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  createdAt: string;
};
type ApiResult = {
  items: Debtor[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const schema = z
  .object({
    type: z.enum(["PERSON", "COMPANY"]),
    firstName: z.string().max(120).optional(),
    lastName: z.string().max(120).optional(),
    companyName: z.string().max(200).optional(),
    email: z.union([z.literal(""), z.string().email()]).optional(),
    phone: z.string().max(50).optional(),
    street: z.string().max(200).optional(),
    postalCode: z.string().max(20).optional(),
    city: z.string().max(120).optional(),
    country: z.string().length(2),
  })
  .superRefine((value, context) => {
    if (value.type === "PERSON" && (!value.firstName || !value.lastName))
      context.addIssue({
        code: "custom",
        message: "Vor- und Nachname sind erforderlich.",
        path: ["lastName"],
      });
    if (value.type === "COMPANY" && !value.companyName)
      context.addIssue({
        code: "custom",
        message: "Firmenname ist erforderlich.",
        path: ["companyName"],
      });
  });
type FormValues = z.infer<typeof schema>;
const emptyValues: FormValues = {
  type: "PERSON",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  street: "",
  postalCode: "",
  city: "",
  country: "DE",
};

function displayName(debtor: Debtor) {
  return debtor.type === "COMPANY"
    ? debtor.companyName || "—"
    : [debtor.firstName, debtor.lastName].filter(Boolean).join(" ") || "—";
}
function normalize(values: FormValues) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? null : value,
    ]),
  );
}

export function DebtorsClient() {
  const [data, setData] = React.useState<ApiResult>({
    items: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
  const [search, setSearch] = React.useState("");
  const [submittedSearch, setSubmittedSearch] = React.useState("");
  const [isLoading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Debtor | null>(null);
  const load = React.useCallback(
    async (page = data.meta.page, query = submittedSearch) => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${API}/debtors?${new URLSearchParams({ page: String(page), limit: "20", ...(query ? { search: query } : {}) })}`,
          { cache: "no-store" },
        );
        if (!response.ok) throw new Error("Schuldner konnten nicht geladen werden.");
        setData(await response.json());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unbekannter Fehler");
      } finally {
        setLoading(false);
      }
    },
    [data.meta.page, submittedSearch],
  );
  React.useEffect(() => {
    void load(1, submittedSearch);
  }, [submittedSearch]);
  const remove = async (debtor: Debtor) => {
    if (!window.confirm(`„${displayName(debtor)}“ wirklich löschen?`)) return;
    const response = await fetch(`${API}/debtors/${debtor.id}`, { method: "DELETE" });
    if (!response.ok) {
      setError("Schuldner konnte nicht gelöscht werden.");
      return;
    }
    void load();
  };
  const columns = React.useMemo(
    () => [
      {
        header: "Schuldner",
        cell: ({ row }: { row: { original: Debtor } }) => (
          <Link className="font-medium hover:text-primary" href={`/schuldner/${row.original.id}`}>
            {displayName(row.original)}
          </Link>
        ),
      },
      {
        header: "Typ",
        cell: ({ row }: { row: { original: Debtor } }) => (
          <span className="text-muted-foreground">
            {row.original.type === "COMPANY" ? "Unternehmen" : "Person"}
          </span>
        ),
      },
      {
        header: "E-Mail",
        cell: ({ row }: { row: { original: Debtor } }) => (
          <span className="text-muted-foreground">{row.original.email || "—"}</span>
        ),
      },
      {
        header: "Ort",
        cell: ({ row }: { row: { original: Debtor } }) => (
          <span className="text-muted-foreground">
            {[row.original.postalCode, row.original.city].filter(Boolean).join(" ") || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }: { row: { original: Debtor } }) => (
          <div className="flex justify-end gap-1">
            <Button
              aria-label="Bearbeiten"
              onClick={() => {
                setEditing(row.original);
                setDialogOpen(true);
              }}
              size="icon"
              variant="ghost"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              aria-label="Löschen"
              onClick={() => void remove(row.original)}
              size="icon"
              variant="ghost"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  );
  const table = useReactTable({ data: data.items, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-primary">Arbeitsbereich</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Schuldner</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Verwalten Sie natürliche Personen und Unternehmen.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="size-4" /> Schuldner anlegen
        </Button>
      </div>
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setSubmittedSearch(search);
              }}
              placeholder="Name, Firma oder E-Mail suchen"
              value={search}
            />
          </div>
          <Button onClick={() => setSubmittedSearch(search)} variant="outline">
            Suchen
          </Button>
        </div>
        {error && (
          <p className="m-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {table.getFlatHeaders().map((header) => (
                  <th className="px-4 py-3 font-medium" key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    Schuldner werden geladen …
                  </td>
                </tr>
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr className="border-b last:border-0" key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td className="px-4 py-4" key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>
                    Keine Schuldner gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 text-sm">
          <span className="text-muted-foreground">{data.meta.total} Einträge</span>
          <div className="flex gap-2">
            <Button
              disabled={data.meta.page <= 1}
              onClick={() => void load(data.meta.page - 1)}
              variant="outline"
            >
              Zurück
            </Button>
            <Button
              disabled={data.meta.page >= data.meta.totalPages}
              onClick={() => void load(data.meta.page + 1)}
              variant="outline"
            >
              Weiter
            </Button>
          </div>
        </div>
      </div>
      <DebtorDialog
        debtor={editing}
        onOpenChange={setDialogOpen}
        onSaved={() => void load(1)}
        open={dialogOpen}
      />
    </section>
  );
}

function DebtorDialog({
  debtor,
  onOpenChange,
  onSaved,
  open,
}: {
  debtor: Debtor | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  open: boolean;
}) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });
  React.useEffect(() => {
    form.reset(
      debtor
        ? {
            type: debtor.type,
            firstName: debtor.firstName || "",
            lastName: debtor.lastName || "",
            companyName: debtor.companyName || "",
            email: debtor.email || "",
            phone: debtor.phone || "",
            street: debtor.street || "",
            postalCode: debtor.postalCode || "",
            city: debtor.city || "",
            country: debtor.country,
          }
        : emptyValues,
    );
  }, [debtor, form, open]);
  const submit = form.handleSubmit(async (values) => {
    const response = await fetch(`${API}/debtors${debtor ? `/${debtor.id}` : ""}`, {
      method: debtor ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(normalize(values)),
    });
    if (!response.ok) {
      form.setError("root", { message: "Speichern war nicht möglich." });
      return;
    }
    onOpenChange(false);
    onSaved();
  });
  const input = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  const message = (name: keyof FormValues) => form.formState.errors[name]?.message;
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {debtor ? "Schuldner bearbeiten" : "Schuldner anlegen"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Stammdaten des Schuldners erfassen.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button aria-label="Schließen" size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-medium">
              Typ
              <select className={input} {...form.register("type")}>
                <option value="PERSON">Natürliche Person</option>
                <option value="COMPANY">Unternehmen</option>
              </select>
            </label>
            {form.watch("type") === "PERSON" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field error={message("firstName")} label="Vorname">
                  <input className={input} {...form.register("firstName")} />
                </Field>
                <Field error={message("lastName")} label="Nachname">
                  <input className={input} {...form.register("lastName")} />
                </Field>
              </div>
            ) : (
              <Field error={message("companyName")} label="Firmenname">
                <input className={input} {...form.register("companyName")} />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field error={message("email")} label="E-Mail">
                <input className={input} type="email" {...form.register("email")} />
              </Field>
              <Field error={message("phone")} label="Telefon">
                <input className={input} {...form.register("phone")} />
              </Field>
            </div>
            <Field error={message("street")} label="Straße und Hausnummer">
              <input className={input} {...form.register("street")} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              <Field error={message("postalCode")} label="PLZ">
                <input className={input} {...form.register("postalCode")} />
              </Field>
              <Field error={message("city")} label="Ort">
                <input className={input} {...form.register("city")} />
              </Field>
            </div>
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Abbrechen
                </Button>
              </Dialog.Close>
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting ? "Speichert …" : "Speichern"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function Field({
  children,
  error,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
