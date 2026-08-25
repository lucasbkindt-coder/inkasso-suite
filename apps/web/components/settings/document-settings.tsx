"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { TenantDocumentSettingsInput } from "@/types/case";
import { caseApi } from "@/components/cases/case-api";

const emptySettings: TenantDocumentSettingsInput = {
  companyName: "",
  street: "",
  postalCode: "",
  city: "",
};

const fields: { key: keyof TenantDocumentSettingsInput; label: string; type?: string }[] = [
  { key: "companyName", label: "Firmenname" },
  { key: "legalName", label: "Rechtlicher Name" },
  { key: "street", label: "Straße" },
  { key: "houseNumber", label: "Hausnummer" },
  { key: "postalCode", label: "PLZ" },
  { key: "city", label: "Ort" },
  { key: "country", label: "Land" },
  { key: "phone", label: "Telefon", type: "tel" },
  { key: "mobile", label: "Mobil", type: "tel" },
  { key: "fax", label: "Fax", type: "tel" },
  { key: "email", label: "E-Mail", type: "email" },
  { key: "website", label: "Website", type: "url" },
  { key: "registrationCourt", label: "Registergericht" },
  { key: "registrationNumber", label: "Registernummer" },
  { key: "vatId", label: "USt-ID" },
  { key: "managingDirector", label: "Geschäftsführung" },
  { key: "iban", label: "IBAN" },
  { key: "bic", label: "BIC" },
  { key: "bankName", label: "Bankname" },
  { key: "creditorId", label: "Gläubiger-ID" },
  { key: "collectionRegistrationAuthority", label: "Zuständige Aufsichtsbehörde" },
  { key: "collectionRegistrationAddress", label: "Anschrift Aufsichtsbehörde" },
  { key: "collectionRegistrationContact", label: "Elektronische Erreichbarkeit Aufsicht", type: "url" },
];

function toInput(value: Awaited<ReturnType<typeof caseApi.getTenantDocumentSettings>>) {
  if (!value) return emptySettings;
  return {
    companyName: value.companyName,
    legalName: value.legalName ?? undefined,
    street: value.street,
    houseNumber: value.houseNumber ?? undefined,
    postalCode: value.postalCode,
    city: value.city,
    country: value.country,
    phone: value.phone ?? undefined,
    mobile: value.mobile ?? undefined,
    fax: value.fax ?? undefined,
    email: value.email ?? undefined,
    website: value.website ?? undefined,
    registrationCourt: value.registrationCourt ?? undefined,
    registrationNumber: value.registrationNumber ?? undefined,
    vatId: value.vatId ?? undefined,
    managingDirector: value.managingDirector ?? undefined,
    iban: value.iban ?? undefined,
    bic: value.bic ?? undefined,
    bankName: value.bankName ?? undefined,
    creditorId: value.creditorId ?? undefined,
    collectionRegistrationAuthority: value.collectionRegistrationAuthority ?? undefined,
    collectionRegistrationAddress: value.collectionRegistrationAddress ?? undefined,
    collectionRegistrationContact: value.collectionRegistrationContact ?? undefined,
    documentFooter: value.documentFooter ?? undefined,
  };
}

export function DocumentSettings() {
  const [values, setValues] = React.useState<TenantDocumentSettingsInput>(emptySettings);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void caseApi
      .getTenantDocumentSettings()
      .then((settings) => setValues(toInput(settings)))
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unternehmensdaten konnten nicht geladen werden.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const setValue = (key: keyof TenantDocumentSettingsInput, value: string) => {
    setValues((current) => ({ ...current, [key]: value || undefined }));
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.companyName || !values.street || !values.postalCode || !values.city) {
      setError("Bitte füllen Sie Firmenname, Straße, PLZ und Ort aus.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await caseApi.saveTenantDocumentSettings(values);
      setValues(toInput(saved));
      setMessage("Unternehmensdaten wurden gespeichert.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unternehmensdaten konnten nicht gespeichert werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Unternehmensdaten &amp; Schreiben</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Diese Angaben werden für Briefkopf, Zahlungsinformationen und den Dokumentenfooter
          verwendet.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Unternehmensdaten werden geladen …</p>
      ) : null}
      {!loading ? (
        <form className="space-y-6" onSubmit={(event) => void save(event)}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map((field) => (
              <label className="grid gap-1.5 text-sm font-medium" key={field.key}>
                {field.label}
                <input
                  className="h-10 rounded-lg border bg-background px-3 font-normal outline-none ring-ring focus:ring-2"
                  type={field.type ?? "text"}
                  value={values[field.key] ?? ""}
                  onChange={(event) => setValue(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Dokumentfooter
            <textarea
              className="min-h-24 rounded-lg border bg-background p-3 font-normal outline-none ring-ring focus:ring-2"
              value={values.documentFooter ?? ""}
              onChange={(event) => setValue("documentFooter", event.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>
          ) : null}
          <Button disabled={saving} type="submit">
            {saving ? "Speichert …" : "Unternehmensdaten speichern"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
