"use client";

import { CheckCircle2, ChevronRight, Loader2, Plus, Send } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { z } from "zod";

import { formatCurrency, formatDate } from "@/components/cases/case-ui";
import { Button } from "@/components/ui/button";
import { portalClientApi } from "@/lib/portal-client-api";
import type {
  ClientSubmissionDetail,
  ClientSubmissionListItem,
  ClientSubmissionStatus,
  CreateClientSubmissionInput,
  CreateClientSubmissionResponse,
} from "@/types/client-submission";
import { clientSubmissionStatusLabels } from "@/types/client-submission";

import { PortalLayout } from "./portal-page";

const statuses: Array<ClientSubmissionStatus | "ALL"> = [
  "ALL",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
];

const statusClasses: Record<ClientSubmissionStatus, string> = {
  SUBMITTED: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  UNDER_REVIEW: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ACCEPTED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  REJECTED: "bg-red-500/10 text-red-700 dark:text-red-300",
};

type FormValues = {
  reference: string;
  debtorType: "PERSON" | "COMPANY";
  debtorFirstName: string;
  debtorLastName: string;
  debtorCompanyName: string;
  debtorStreet: string;
  debtorHouseNumber: string;
  debtorPostalCode: string;
  debtorCity: string;
  debtorCountry: string;
  debtorEmail: string;
  debtorPhone: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  principalAmount: string;
  claimDescription: string;
  clientNote: string;
};

const initialValues: FormValues = {
  reference: "",
  debtorType: "PERSON",
  debtorFirstName: "",
  debtorLastName: "",
  debtorCompanyName: "",
  debtorStreet: "",
  debtorHouseNumber: "",
  debtorPostalCode: "",
  debtorCity: "",
  debtorCountry: "DE",
  debtorEmail: "",
  debtorPhone: "",
  invoiceNumber: "",
  invoiceDate: "",
  dueDate: "",
  principalAmount: "",
  claimDescription: "",
  clientNote: "",
};

function optional(value: string) {
  return value.trim() || undefined;
}

function normalizeGermanAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "");
  if (!normalized) return "";
  if (normalized.includes(",")) return normalized.replace(/\./g, "").replace(",", ".");
  return /^\d{1,3}(?:\.\d{3})+$/.test(normalized) ? normalized.replace(/\./g, "") : normalized;
}

function isPositiveDecimal(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false;
  return /[1-9]/.test(value.replace(/\D/g, ""));
}

const submissionSchema = z
  .object({
    debtorType: z.enum(["PERSON", "COMPANY"]),
    debtorFirstName: z.string(),
    debtorLastName: z.string(),
    debtorCompanyName: z.string(),
    debtorStreet: z.string().trim().min(1, "Straße ist erforderlich."),
    debtorPostalCode: z.string().trim().min(1, "PLZ ist erforderlich."),
    debtorCity: z.string().trim().min(1, "Ort ist erforderlich."),
    debtorEmail: z.string(),
    dueDate: z.string().min(1, "Fälligkeitsdatum ist erforderlich."),
    invoiceDate: z.string(),
    principalAmount: z.string(),
  })
  .superRefine((value, context) => {
    if (value.debtorType === "PERSON") {
      if (!value.debtorFirstName.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["debtorFirstName"],
          message: "Vorname ist erforderlich.",
        });
      }
      if (!value.debtorLastName.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["debtorLastName"],
          message: "Nachname ist erforderlich.",
        });
      }
    }
    if (value.debtorType === "COMPANY" && !value.debtorCompanyName.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debtorCompanyName"],
        message: "Firmenname ist erforderlich.",
      });
    }
    if (
      value.debtorEmail.trim() &&
      !z.string().email().safeParse(value.debtorEmail.trim()).success
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debtorEmail"],
        message: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      });
    }
    if (!isPositiveDecimal(normalizeGermanAmount(value.principalAmount))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["principalAmount"],
        message: "Die Hauptforderung muss größer als 0 sein.",
      });
    }
    if (value.invoiceDate && value.dueDate && value.invoiceDate > value.dueDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["invoiceDate"],
        message: "Rechnungsdatum darf nicht nach dem Fälligkeitsdatum liegen.",
      });
    }
  });

function usePreviewToken() {
  return useSearchParams().get("preview") ?? "";
}

function PortalError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </p>
  );
}

function StatusBadge({ status }: { status: ClientSubmissionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}
    >
      {clientSubmissionStatusLabels[status]}
    </span>
  );
}

function SubmissionLink({
  id,
  token,
  children,
}: {
  id: string;
  token?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={`/portal/mandant/auftraege/${id}${token ? `?preview=${encodeURIComponent(token)}` : ""}`}>
      {children}
    </Link>
  );
}

export function ClientSubmissionsListPage() {
  const token = usePreviewToken();
  const [items, setItems] = React.useState<ClientSubmissionListItem[]>([]);
  const [filter, setFilter] = React.useState<ClientSubmissionStatus | "ALL">("ALL");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    void portalClientApi
      .getClientSubmissions(token)
      .then(setItems)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Aufträge konnten nicht geladen werden."),
      )
      .finally(() => setLoading(false));
  }, [token]);

  const filteredItems = filter === "ALL" ? items : items.filter((item) => item.status === filter);
  return (
    <PortalLayout type="Mandantenportal">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Mandantenportal</p>
          <h1 className="text-3xl font-semibold tracking-tight">Aufträge</h1>
          <p className="mt-2 text-muted-foreground">
            Ihre eingereichten Inkassoaufträge im Überblick.
          </p>
        </div>
        <Link href={`/portal/mandant/auftraege/neu${token ? `?preview=${encodeURIComponent(token)}` : ""}`}>
          <Button>
            <Plus className="size-4" /> Neuen Inkassoauftrag einreichen
          </Button>
        </Link>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {statuses.map((status) => (
          <Button
            key={status}
            onClick={() => setFilter(status)}
            size="default"
            variant={filter === status ? "default" : "outline"}
          >
            {status === "ALL" ? "Alle" : clientSubmissionStatusLabels[status]}
          </Button>
        ))}
      </div>

      <div className="mt-6">
        {error ? <PortalError message={error} /> : null}
        {loading ? <p className="text-muted-foreground">Aufträge werden geladen …</p> : null}
        {!loading && !error && filteredItems.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center">
            <p className="font-medium">Noch keine Inkassoaufträge eingereicht.</p>
            <Link
              className="mt-4 inline-block"
              href={`/portal/mandant/auftraege/neu${token ? `?preview=${encodeURIComponent(token)}` : ""}`}
            >
              <Button>Neuen Inkassoauftrag einreichen</Button>
            </Link>
          </div>
        ) : null}
        {!loading && !error && filteredItems.length > 0 ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.4fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_auto] gap-4 border-b px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
              <span>Eingangs-ID / Referenz</span>
              <span>Schuldner</span>
              <span>Hauptforderung</span>
              <span>Eingereicht</span>
              <span>Status</span>
            </div>
            {filteredItems.map((item) => (
              <SubmissionLink id={item.id} key={item.id} token={token}>
                <div className="grid gap-2 border-b px-5 py-4 transition-colors hover:bg-muted/50 md:grid-cols-[minmax(8rem,1fr)_minmax(10rem,1.4fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)_auto] md:items-center md:gap-4 last:border-b-0">
                  <div>
                    <p className="font-medium">{item.reference || `#${item.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground">#{item.id.slice(0, 8)}</p>
                  </div>
                  <p>{item.debtorDisplayName || "—"}</p>
                  <p className="font-medium">
                    {formatCurrency(item.principalAmount, item.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDate(item.submittedAt)}</p>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={item.status} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                  {item.status === "ACCEPTED" && item.acceptedCaseId && item.acceptedCaseNumber ? (
                    <p className="text-sm text-muted-foreground md:col-start-4 md:col-end-6">
                      Aktenzeichen: {item.acceptedCaseNumber}
                    </p>
                  ) : null}
                </div>
              </SubmissionLink>
            ))}
          </div>
        ) : null}
      </div>
    </PortalLayout>
  );
}

export function NewClientSubmissionPage() {
  const token = usePreviewToken();
  const router = useRouter();
  const [values, setValues] = React.useState<FormValues>(initialValues);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormValues, string>>>({});
  const [requestError, setRequestError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState<CreateClientSubmissionResponse | null>(null);
  const setValue = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestError("");
    const parsed = submissionSchema.safeParse(values);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormValues | undefined;
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload: CreateClientSubmissionInput = {
        reference: optional(values.reference),
        debtorType: values.debtorType,
        debtorFirstName:
          values.debtorType === "PERSON" ? optional(values.debtorFirstName) : undefined,
        debtorLastName:
          values.debtorType === "PERSON" ? optional(values.debtorLastName) : undefined,
        debtorCompanyName:
          values.debtorType === "COMPANY" ? optional(values.debtorCompanyName) : undefined,
        debtorStreet: values.debtorStreet.trim(),
        debtorHouseNumber: optional(values.debtorHouseNumber),
        debtorPostalCode: values.debtorPostalCode.trim(),
        debtorCity: values.debtorCity.trim(),
        debtorCountry: values.debtorCountry.trim().toUpperCase() || "DE",
        debtorEmail: optional(values.debtorEmail),
        debtorPhone: optional(values.debtorPhone),
        invoiceNumber: optional(values.invoiceNumber),
        invoiceDate: optional(values.invoiceDate),
        dueDate: values.dueDate,
        principalAmount: normalizeGermanAmount(values.principalAmount),
        currency: "EUR",
        claimDescription: optional(values.claimDescription),
        clientNote: optional(values.clientNote),
      };
      setSuccess(await portalClientApi.createClientSubmission(payload, token));
    } catch (cause) {
      setRequestError(
        cause instanceof Error ? cause.message : "Der Auftrag konnte nicht eingereicht werden.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <PortalLayout type="Mandantenportal">
        <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 sm:p-8">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-semibold">Inkassoauftrag wurde übermittelt.</h1>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <dt className="text-muted-foreground">Eingangs-ID</dt>
            <dd>#{success.id.slice(0, 8)}</dd>
            <dt className="text-muted-foreground">Referenz</dt>
            <dd>{success.reference || "—"}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusBadge status={success.status} />
            </dd>
            <dt className="text-muted-foreground">Eingangszeitpunkt</dt>
            <dd>{formatDate(success.submittedAt)}</dd>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              onClick={() =>
                router.push(`/portal/mandant/auftraege${token ? `?preview=${encodeURIComponent(token)}` : ""}`)
              }
              variant="outline"
            >
              Zu meinen Aufträgen
            </Button>
            <Button
              onClick={() =>
                router.push(
                  `/portal/mandant/auftraege/${success.id}${token ? `?preview=${encodeURIComponent(token)}` : ""}`,
                )
              }
            >
              Auftragsdetails
            </Button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout type="Mandantenportal">
      <div className="max-w-3xl">
        <p className="text-sm text-muted-foreground">Mandantenportal</p>
        <h1 className="text-3xl font-semibold tracking-tight">Neuer Inkassoauftrag</h1>
        <p className="mt-2 text-muted-foreground">
          Übermitteln Sie die Angaben für einen neuen Inkassoauftrag an payveo.
        </p>
      </div>
      <form className="mt-8 space-y-6" noValidate onSubmit={(event) => void submit(event)}>
        <FormSection title="A. Ihre Referenz">
          <Field label="Eigenes Aktenzeichen / Referenz">
            <TextInput
              onChange={(value) => setValue("reference", value)}
              value={values.reference}
            />
          </Field>
        </FormSection>
        <FormSection title="B. Schuldner">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Schuldnertyp">
              <select
                className="h-10 w-full rounded-lg border bg-background px-3"
                onChange={(event) =>
                  setValue("debtorType", event.target.value as FormValues["debtorType"])
                }
                value={values.debtorType}
              >
                <option value="PERSON">Privatperson</option>
                <option value="COMPANY">Unternehmen</option>
              </select>
            </Field>
          </div>
          {values.debtorType === "PERSON" ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field error={errors.debtorFirstName} label="Vorname *">
                <TextInput
                  onChange={(value) => setValue("debtorFirstName", value)}
                  value={values.debtorFirstName}
                />
              </Field>
              <Field error={errors.debtorLastName} label="Nachname *">
                <TextInput
                  onChange={(value) => setValue("debtorLastName", value)}
                  value={values.debtorLastName}
                />
              </Field>
            </div>
          ) : (
            <div className="mt-4">
              <Field error={errors.debtorCompanyName} label="Firmenname *">
                <TextInput
                  onChange={(value) => setValue("debtorCompanyName", value)}
                  value={values.debtorCompanyName}
                />
              </Field>
            </div>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field error={errors.debtorStreet} label="Straße *">
              <TextInput
                onChange={(value) => setValue("debtorStreet", value)}
                value={values.debtorStreet}
              />
            </Field>
            <Field label="Hausnummer">
              <TextInput
                onChange={(value) => setValue("debtorHouseNumber", value)}
                value={values.debtorHouseNumber}
              />
            </Field>
            <Field error={errors.debtorPostalCode} label="PLZ *">
              <TextInput
                onChange={(value) => setValue("debtorPostalCode", value)}
                value={values.debtorPostalCode}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field error={errors.debtorCity} label="Ort *">
              <TextInput
                onChange={(value) => setValue("debtorCity", value)}
                value={values.debtorCity}
              />
            </Field>
            <Field label="Land">
              <TextInput
                onChange={(value) => setValue("debtorCountry", value.toUpperCase())}
                value={values.debtorCountry}
              />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field error={errors.debtorEmail} label="E-Mail">
              <TextInput
                inputMode="email"
                onChange={(value) => setValue("debtorEmail", value)}
                type="email"
                value={values.debtorEmail}
              />
            </Field>
            <Field label="Telefon">
              <TextInput
                onChange={(value) => setValue("debtorPhone", value)}
                value={values.debtorPhone}
              />
            </Field>
          </div>
        </FormSection>
        <FormSection title="C. Forderung">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rechnungsnummer">
              <TextInput
                onChange={(value) => setValue("invoiceNumber", value)}
                value={values.invoiceNumber}
              />
            </Field>
            <Field error={errors.invoiceDate} label="Rechnungsdatum">
              <TextInput
                onChange={(value) => setValue("invoiceDate", value)}
                type="date"
                value={values.invoiceDate}
              />
            </Field>
            <Field error={errors.dueDate} label="Fälligkeitsdatum *">
              <TextInput
                onChange={(value) => setValue("dueDate", value)}
                type="date"
                value={values.dueDate}
              />
            </Field>
            <Field error={errors.principalAmount} label="Hauptforderung *">
              <TextInput
                inputMode="decimal"
                onChange={(value) => setValue("principalAmount", value)}
                placeholder="z. B. 1.248,53"
                value={values.principalAmount}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Forderungsgrund / Beschreibung">
              <textarea
                className="min-h-24 w-full rounded-lg border bg-background p-3"
                onChange={(event) => setValue("claimDescription", event.target.value)}
                value={values.claimDescription}
              />
            </Field>
          </div>
        </FormSection>
        <FormSection title="D. Hinweis an payveo">
          <Field
            hint="Dieser Hinweis ist nicht im Schuldnerportal sichtbar."
            label="Hinweis an payveo"
          >
            <textarea
              className="min-h-24 w-full rounded-lg border bg-background p-3"
              onChange={(event) => setValue("clientNote", event.target.value)}
              value={values.clientNote}
            />
          </Field>
        </FormSection>
        <FormSection title="E. Zusammenfassung / Absenden">
          <SubmissionSummary values={values} />
          {requestError ? (
            <div className="mt-4">
              <PortalError message={requestError} />
            </div>
          ) : null}
          <div className="mt-6 flex justify-end">
            <Button disabled={saving} type="submit">
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Auftrag wird eingereicht …
                </>
              ) : (
                <>
                  <Send className="size-4" /> Inkassoauftrag einreichen
                </>
              )}
            </Button>
          </div>
        </FormSection>
      </form>
    </PortalLayout>
  );
}

export function ClientSubmissionDetailPage() {
  const token = usePreviewToken();
  const params = useParams<{ id: string }>();
  const [item, setItem] = React.useState<ClientSubmissionDetail | null>(null);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    void portalClientApi
      .getClientSubmission(params.id, token)
      .then(setItem)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Auftragsdetails konnten nicht geladen werden.",
        ),
      );
  }, [params.id, token]);
  return (
    <PortalLayout type="Mandantenportal">
      {error ? (
        <PortalError message={error} />
      ) : !item ? (
        <p className="text-muted-foreground">Auftragsdetails werden geladen …</p>
      ) : (
        <SubmissionDetail item={item} token={token} />
      )}
    </PortalLayout>
  );
}

function SubmissionDetail({ item, token }: { item: ClientSubmissionDetail; token?: string }) {
  const debtorName =
    item.debtorType === "PERSON"
      ? [item.debtorFirstName, item.debtorLastName].filter(Boolean).join(" ")
      : item.debtorCompanyName;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="text-sm text-primary hover:underline"
            href={`/portal/mandant/auftraege${token ? `?preview=${encodeURIComponent(token)}` : ""}`}
          >
            ← Zu meinen Aufträgen
          </Link>
          <h1 className="mt-3 text-3xl font-semibold">
            {item.reference || `Auftrag #${item.id.slice(0, 8)}`}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Eingangs-ID: #{item.id.slice(0, 8)} · eingereicht am {formatDate(item.submittedAt)}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <DetailCard title="Schuldner">
          <DetailRow
            label="Typ"
            value={item.debtorType === "PERSON" ? "Privatperson" : "Unternehmen"}
          />
          <DetailRow label="Name" value={debtorName || "—"} />
          <DetailRow
            label="Anschrift"
            value={[
              item.debtorStreet,
              item.debtorHouseNumber,
              `${item.debtorPostalCode} ${item.debtorCity}`,
              item.debtorCountry,
            ]
              .filter(Boolean)
              .join(", ")}
          />
          <DetailRow label="E-Mail" value={item.debtorEmail || "—"} />
          <DetailRow label="Telefon" value={item.debtorPhone || "—"} />
        </DetailCard>
        <DetailCard title="Forderung">
          <DetailRow label="Rechnungsnummer" value={item.invoiceNumber || "—"} />
          <DetailRow label="Rechnungsdatum" value={formatDate(item.invoiceDate)} />
          <DetailRow label="Fälligkeitsdatum" value={formatDate(item.dueDate)} />
          <DetailRow
            label="Hauptforderung"
            value={formatCurrency(item.principalAmount, item.currency)}
          />
          <DetailRow label="Beschreibung" value={item.claimDescription || "—"} />
        </DetailCard>
          <DetailCard title="Hinweis an payveo">
          <p className="whitespace-pre-wrap text-sm">
            {item.clientNote || "Kein Hinweis hinterlegt."}
          </p>
        </DetailCard>
        {item.status === "ACCEPTED" && item.acceptedCaseNumber ? (
          <DetailCard title="payveo-Akte">
            <p className="font-medium">{item.acceptedCaseNumber}</p>
            {item.acceptedCaseId ? (
              <Link
                className="mt-3 inline-block text-sm text-primary hover:underline"
                href={`/portal/mandant/akten/${item.acceptedCaseId}${token ? `?preview=${encodeURIComponent(token)}` : ""}`}
              >
                Inkassoakte öffnen
              </Link>
            ) : null}
          </DetailCard>
        ) : null}
      </div>
    </>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
      {error ? <span className="text-xs font-normal text-destructive">{error}</span> : null}
    </label>
  );
}
function TextInput({
  value,
  onChange,
  type = "text",
  inputMode,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: React.HTMLInputTypeAttribute;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
}) {
  return (
    <input
      className="h-10 w-full rounded-lg border bg-background px-3 font-normal"
      inputMode={inputMode}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type={type}
      value={value}
    />
  );
}
function SubmissionSummary({ values }: { values: FormValues }) {
  const name =
    values.debtorType === "PERSON"
      ? [values.debtorFirstName, values.debtorLastName].filter(Boolean).join(" ")
      : values.debtorCompanyName;
  const amount = normalizeGermanAmount(values.principalAmount);
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <DetailRow label="Schuldner" value={name || "—"} />
      <DetailRow
        label="Anschrift"
        value={
          [
            values.debtorStreet,
            values.debtorHouseNumber,
            `${values.debtorPostalCode} ${values.debtorCity}`,
          ]
            .filter(Boolean)
            .join(", ") || "—"
        }
      />
      <DetailRow label="Rechnungsnummer" value={values.invoiceNumber || "—"} />
      <DetailRow label="Fälligkeit" value={values.dueDate ? formatDate(values.dueDate) : "—"} />
      <DetailRow
        label="Hauptforderung"
        value={isPositiveDecimal(amount) ? formatCurrency(amount, "EUR") : "—"}
      />
      <DetailRow label="Referenz" value={values.reference || "—"} />
    </dl>
  );
}
function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <dl className="mt-4 grid gap-3">{children}</dl>
    </section>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium whitespace-pre-wrap">{value}</dd>
    </div>
  );
}
