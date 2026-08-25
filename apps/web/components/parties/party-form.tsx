"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { type PartyDetail, type PartyInput, type PartyRole, partyApi } from "./party-api";

const roles = ["CLIENT", "DEBTOR", "CONTACT", "OTHER"] as const;
const schema = z
  .object({
    type: z.enum(["PERSON", "COMPANY"]),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    salutation: z.string().optional(),
    title: z.string().optional(),
    birthDate: z.string().optional(),
    legalForm: z.string().optional(),
    vatId: z.string().optional(),
    taxNumber: z.string().optional(),
    commercialRegister: z.string().optional(),
    registerNumber: z.string().optional(),
    roles: z.array(z.enum(roles)).min(1, "Mindestens eine Rolle auswählen."),
    street: z.string().min(1, "Straße ist erforderlich."),
    houseNumber: z.string().optional(),
    addressLine2: z.string().optional(),
    postalCode: z.string().min(1, "PLZ ist erforderlich."),
    city: z.string().min(1, "Ort ist erforderlich."),
    contacts: z.array(
      z.object({
        type: z.enum(["EMAIL", "PHONE", "MOBILE", "FAX", "WEBSITE"]),
        value: z.string().min(1, "Wert ist erforderlich."),
        label: z.string().optional(),
        isPrimary: z.boolean(),
      }),
    ),
  })
  .superRefine((v, c) => {
    if (v.type === "PERSON" && (!v.firstName || !v.lastName))
      c.addIssue({
        code: "custom",
        path: ["lastName"],
        message: "Vor- und Nachname sind erforderlich.",
      });
    if (v.type === "COMPANY" && !v.companyName)
      c.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Firmenname ist erforderlich.",
      });
  });
type Values = z.infer<typeof schema>;
const empty: Values = {
  type: "PERSON",
  firstName: "",
  lastName: "",
  companyName: "",
  salutation: "",
  title: "",
  birthDate: "",
  legalForm: "",
  vatId: "",
  taxNumber: "",
  commercialRegister: "",
  registerNumber: "",
  roles: ["DEBTOR"],
  street: "",
  houseNumber: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  contacts: [],
};
export function PartyForm({
  party,
  initialRoles = ["DEBTOR"],
  onSaved,
}: {
  party?: PartyDetail;
  initialRoles?: PartyRole[];
  onSaved: (party: PartyDetail) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: party
      ? {
          ...empty,
          ...party,
          street: party.addresses[0]?.street || "",
          houseNumber: party.addresses[0]?.houseNumber || "",
          addressLine2: party.addresses[0]?.addressLine2 || "",
          postalCode: party.addresses[0]?.postalCode || "",
          city: party.addresses[0]?.city || "",
          contacts: party.contacts.length ? party.contacts : empty.contacts,
        }
      : { ...empty, roles: initialRoles },
  });
  const contacts = useFieldArray({ control: form.control, name: "contacts" });
  const type = form.watch("type");
  const submit = form.handleSubmit(async (v) => {
    const { street, houseNumber, addressLine2, postalCode, city, ...partyValues } = v;
    const data: PartyInput = {
      ...partyValues,
      addresses: [
        {
          type: "PRIMARY",
          street,
          houseNumber,
          addressLine2,
          postalCode,
          city,
          country: "DE",
          isPrimary: true,
        },
      ],
    };
    try {
      onSaved(party ? await partyApi.update(party.id, data) : await partyApi.create(data));
    } catch (error) {
      form.setError("root", {
        message: error instanceof Error ? error.message : "Speichern fehlgeschlagen.",
      });
    }
  });
  const input = "mt-1 h-10 w-full rounded-lg border bg-background px-3 text-sm";
  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium">
        Partei-Typ
        <select className={input} disabled={!!party} {...form.register("type")}>
          <option value="PERSON">Person</option>
          <option value="COMPANY">Unternehmen</option>
        </select>
      </label>
      {type === "PERSON" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Anrede">
            <input className={input} {...form.register("salutation")} />
          </Field>
          <Field label="Titel">
            <input className={input} {...form.register("title")} />
          </Field>
          <Field label="Vorname">
            <input className={input} {...form.register("firstName")} />
          </Field>
          <Field label="Nachname" error={form.formState.errors.lastName?.message}>
            <input className={input} {...form.register("lastName")} />
          </Field>
          <Field label="Geburtsdatum">
            <input className={input} type="date" {...form.register("birthDate")} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Firmenname", "companyName"],
            ["Rechtsform", "legalForm"],
            ["USt-ID", "vatId"],
            ["Steuernummer", "taxNumber"],
            ["Handelsregister", "commercialRegister"],
            ["Registernummer", "registerNumber"],
          ].map(([label, name]) => (
            <Field label={label} key={name}>
              <input className={input} {...form.register(name as keyof Values)} />
            </Field>
          ))}
        </div>
      )}
      <div>
        <p className="text-sm font-medium">Rollen</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {roles.map((role) => (
            <label className="flex items-center gap-2 text-sm" key={role}>
              <input type="checkbox" value={role} {...form.register("roles")} />
              {role}
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Straße">
          <input className={input} {...form.register("street")} />
        </Field>
        <Field label="Hausnummer">
          <input className={input} {...form.register("houseNumber")} />
        </Field>
        <Field label="PLZ">
          <input className={input} {...form.register("postalCode")} />
        </Field>
        <Field label="Ort">
          <input className={input} {...form.register("city")} />
        </Field>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Kontakte</p>
        {contacts.fields.map((field, index) => (
          <div className="mb-2 grid gap-2 sm:grid-cols-[120px_1fr_auto]" key={field.id}>
            <select className={input} {...form.register(`contacts.${index}.type`)}>
              <option value="EMAIL">E-Mail</option>
              <option value="PHONE">Telefon</option>
              <option value="MOBILE">Mobil</option>
              <option value="FAX">Fax</option>
              <option value="WEBSITE">Website</option>
            </select>
            <input
              className={input}
              placeholder="Kontaktwert"
              {...form.register(`contacts.${index}.value`)}
            />
            <Button
              onClick={() => contacts.remove(index)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button
          onClick={() => contacts.append({ type: "EMAIL", value: "", label: "", isPrimary: false })}
          type="button"
          variant="outline"
        >
          <Plus className="size-4" /> Kontakt
        </Button>
      </div>
      {form.formState.errors.root && (
        <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}
      <Button disabled={form.formState.isSubmitting} type="submit">
        {form.formState.isSubmitting ? "Speichert …" : "Speichern"}
      </Button>
    </form>
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
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
