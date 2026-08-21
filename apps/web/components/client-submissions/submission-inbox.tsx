"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, ChevronRight, Loader2, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";

import { formatCurrency, formatDate } from "@/components/cases/case-ui";
import { caseApi } from "@/components/cases/case-api";
import { Button } from "@/components/ui/button";
import type {
  AcceptClientSubmissionInput,
  ClientSubmissionStatus,
  DebtorCandidate,
  InternalClientSubmission,
} from "@/types/client-submission";
import { clientSubmissionStatusLabels } from "@/types/client-submission";

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

function StatusBadge({ status }: { status: ClientSubmissionStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}
    >
      {clientSubmissionStatusLabels[status]}
    </span>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </p>
  );
}

export function SubmissionInbox() {
  const [items, setItems] = React.useState<InternalClientSubmission[]>([]);
  const [status, setStatus] = React.useState<ClientSubmissionStatus | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await caseApi.getClientSubmissions({
        pageSize: 100,
        status: status === "ALL" ? undefined : status,
        search: search.trim() || undefined,
      });
      setItems(response.items);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Auftragseingang konnte nicht geladen werden.",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Arbeitsorganisation</p>
          <h1 className="text-3xl font-semibold tracking-tight">Auftragseingang</h1>
          <p className="mt-2 text-muted-foreground">
            Eingereichte Mandantenaufträge prüfen und in Inkassoakten übernehmen.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statuses.map((value) => (
            <Button
              key={value}
              onClick={() => setStatus(value)}
              variant={status === value ? "default" : "outline"}
            >
              {value === "ALL" ? "Alle" : clientSubmissionStatusLabels[value]}
            </Button>
          ))}
        </div>
        <label className="relative block sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mandant, Schuldner, Referenz …"
            value={search}
          />
        </label>
      </div>
      <div className="mt-6">
        {error ? <ErrorMessage message={error} /> : null}
        {loading ? <p className="text-muted-foreground">Aufträge werden geladen …</p> : null}
        {!loading && !error && items.length === 0 ? (
          <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
            Keine Aufträge für diesen Filter gefunden.
          </div>
        ) : null}
        {!loading && !error && items.length ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="hidden grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(8rem,1fr)_minmax(7rem,0.7fr)_minmax(8rem,0.7fr)_auto] gap-4 border-b px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Mandant</span>
              <span>Schuldner</span>
              <span>Referenz / Rechnung</span>
              <span>Hauptforderung</span>
              <span>Eingereicht</span>
              <span>Status</span>
            </div>
            {items.map((item) => (
              <Link
                className="block border-b px-5 py-4 transition-colors hover:bg-muted/50 last:border-b-0"
                href={`/auftragseingang/${item.id}`}
                key={item.id}
              >
                <div className="grid gap-2 lg:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(8rem,1fr)_minmax(7rem,0.7fr)_minmax(8rem,0.7fr)_auto] lg:items-center lg:gap-4">
                  <p className="font-medium">{item.clientParty.displayName}</p>
                  <p>{debtorName(item)}</p>
                  <p className="text-sm">
                    {item.reference || "—"}
                    <span className="block text-muted-foreground">
                      {item.invoiceNumber || "Keine Rechnungsnr."}
                    </span>
                  </p>
                  <p className="font-medium">
                    {formatCurrency(item.principalAmount, item.currency)}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDate(item.submittedAt)}</p>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={item.status} />
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SubmissionDetail() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [submission, setSubmission] = React.useState<InternalClientSubmission | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [actionError, setActionError] = React.useState("");
  const [acting, setActing] = React.useState(false);
  const [acceptOpen, setAcceptOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSubmission(await caseApi.getClientSubmission(params.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Auftrag konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const review = async () => {
    setActing(true);
    setActionError("");
    try {
      await caseApi.reviewClientSubmission(params.id);
      await load();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Auftrag konnte nicht in Prüfung gesetzt werden.",
      );
    } finally {
      setActing(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">Auftrag wird geladen …</p>;
  if (error || !submission)
    return <ErrorMessage message={error || "Auftrag wurde nicht gefunden."} />;
  const reviewName =
    submission.reviewedByMembership?.user.displayName ||
    submission.reviewedByMembership?.user.email ||
    "—";
  return (
    <div>
      <Link className="text-sm text-primary hover:underline" href="/auftragseingang">
        ← Zum Auftragseingang
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Mandant: {submission.clientParty.displayName}
          </p>
          <h1 className="text-3xl font-semibold">
            {submission.reference || `Auftrag #${submission.id.slice(0, 8)}`}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Eingereicht am {formatDate(submission.submittedAt)}
          </p>
        </div>
        <StatusBadge status={submission.status} />
      </div>
      {actionError ? (
        <div className="mt-5">
          <ErrorMessage message={actionError} />
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {submission.status === "SUBMITTED" ? (
          <Button disabled={acting} onClick={() => void review()} variant="outline">
            {acting ? <Loader2 className="size-4 animate-spin" /> : null} In Prüfung setzen
          </Button>
        ) : null}
        {submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW" ? (
          <>
            <Button disabled={acting} onClick={() => setAcceptOpen(true)}>
              {acting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}{" "}
              Annehmen
            </Button>
            <Button disabled={acting} onClick={() => setRejectOpen(true)} variant="outline">
              <XCircle className="size-4" /> Ablehnen
            </Button>
          </>
        ) : null}
        {submission.status === "ACCEPTED" && submission.acceptedCaseId ? (
          <Link href={`/akten/${submission.acceptedCaseId}`}>
            <Button>Inkassoakte öffnen</Button>
          </Link>
        ) : null}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <DetailCard title="Mandant">
          <DetailRow label="Name" value={submission.clientParty.displayName} />
          <DetailRow label="CLIENT-Party" value={submission.clientPartyId} />
        </DetailCard>
        <DetailCard title="Schuldner">
          <DetailRow
            label="Typ"
            value={submission.debtorType === "PERSON" ? "Privatperson" : "Unternehmen"}
          />
          <DetailRow label="Name / Firma" value={debtorName(submission)} />
          <DetailRow label="Anschrift" value={address(submission)} />
          <DetailRow label="E-Mail" value={submission.debtorEmail || "—"} />
          <DetailRow label="Telefon" value={submission.debtorPhone || "—"} />
        </DetailCard>
        <DetailCard title="Forderung">
          <DetailRow label="Rechnungsnummer" value={submission.invoiceNumber || "—"} />
          <DetailRow label="Rechnungsdatum" value={formatDate(submission.invoiceDate)} />
          <DetailRow label="Fälligkeit" value={formatDate(submission.dueDate)} />
          <DetailRow
            label="Hauptforderung"
            value={formatCurrency(submission.principalAmount, submission.currency)}
          />
          <DetailRow label="Forderungsgrund" value={submission.claimDescription || "—"} />
        </DetailCard>
        <DetailCard title="Status und Prüfung">
          <DetailRow label="Eingereicht" value={formatDate(submission.submittedAt)} />
          <DetailRow label="In Prüfung seit" value={formatDate(submission.reviewedAt)} />
          <DetailRow label="Geprüft von" value={reviewName} />
          <DetailRow label="Angenommen am" value={formatDate(submission.acceptedAt)} />
          <DetailRow label="Abgelehnt am" value={formatDate(submission.rejectedAt)} />
          <DetailRow label="Ablehnungsgrund" value={submission.rejectionReason || "—"} />
        </DetailCard>
        <DetailCard title="Angaben des Mandanten">
          <DetailRow label="Eigene Referenz" value={submission.reference || "—"} />
          <DetailRow label="Hinweis an payveo" value={submission.clientNote || "—"} />
        </DetailCard>
      </div>
      <AcceptDialog
        onAccepted={() => void load()}
        onOpenChange={setAcceptOpen}
        open={acceptOpen}
        submission={submission}
      />
      <RejectDialog
        onRejected={() => void load()}
        onOpenChange={setRejectOpen}
        open={rejectOpen}
        submission={submission}
      />
    </div>
  );
}

function AcceptDialog({
  submission,
  open,
  onOpenChange,
  onAccepted,
}: {
  submission: InternalClientSubmission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
}) {
  const [candidates, setCandidates] = React.useState<DebtorCandidate[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [resolution, setResolution] = React.useState<"UNSELECTED" | "NEW" | "EXISTING">(
    "UNSELECTED",
  );
  const [debtorPartyId, setDebtorPartyId] = React.useState("");
  const [strongMatchOverrideConfirmed, setStrongMatchOverrideConfirmed] = React.useState(false);
  const [strongMatchOverrideReason, setStrongMatchOverrideReason] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    setResolution("UNSELECTED");
    setDebtorPartyId("");
    setStrongMatchOverrideConfirmed(false);
    setStrongMatchOverrideReason("");
    setError("");
    setLoading(true);
    void caseApi
      .getSubmissionDebtorCandidates(submission.id)
      .then(setCandidates)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Mögliche Schuldner konnten nicht geladen werden.",
        ),
      )
      .finally(() => setLoading(false));
  }, [open, submission.id]);
  const accept = async () => {
    if (resolution === "UNSELECTED")
      return setError(
        "Bitte entscheiden Sie, ob ein bestehender oder ein neuer Schuldner verwendet wird.",
      );
    if (resolution === "EXISTING" && !debtorPartyId)
      return setError("Bitte wählen Sie einen bestehenden Schuldner aus.");
    const hasStrongMatch = candidates.some((candidate) => candidate.matchStrength === "STRONG");
    if (
      resolution === "NEW" &&
      hasStrongMatch &&
      (!strongMatchOverrideConfirmed || !strongMatchOverrideReason.trim())
    ) {
      return setError(
        "Für einen neuen Schuldner trotz möglicher Dublette sind Bestätigung und Begründung erforderlich.",
      );
    }
    const payload: AcceptClientSubmissionInput =
      resolution === "EXISTING"
        ? { debtorResolution: "EXISTING", debtorPartyId }
        : {
            debtorResolution: "NEW",
            strongMatchOverrideConfirmed: hasStrongMatch ? strongMatchOverrideConfirmed : undefined,
            strongMatchOverrideReason: hasStrongMatch
              ? strongMatchOverrideReason.trim()
              : undefined,
          };
    setSaving(true);
    setError("");
    try {
      await caseApi.acceptClientSubmission(submission.id, payload);
      onOpenChange(false);
      onAccepted();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Der Auftrag konnte nicht angenommen werden.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <Dialog.Title className="text-xl font-semibold">
            Mandantenauftrag als Inkassoakte übernehmen?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Mandant: {submission.clientParty.displayName} · Schuldner: {debtorName(submission)} ·
            Hauptforderung: {formatCurrency(submission.principalAmount, submission.currency)}
          </Dialog.Description>
          <p className="mt-4 rounded-lg bg-muted p-3 text-sm">
            Bei der Übernahme wird je nach Ihrer Entscheidung eine neue Schuldner-Partei und
            Inkassoakte angelegt oder ein bestehender Schuldner verwendet.
          </p>
          <h3 className="mt-6 font-semibold">Schuldnerzuordnung</h3>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Mögliche bestehende Schuldner werden gesucht …
            </p>
          ) : null}
          {!loading && candidates.some((candidate) => candidate.matchStrength === "STRONG") ? (
            <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-semibold">Sehr wahrscheinlicher bestehender Schuldner gefunden</p>
              <p className="mt-1">
                Bitte prüfen Sie zuerst die hervorgehobenen Stammsätze und verwenden Sie einen
                bestehenden Schuldner, wenn es sich um dieselbe Person oder dasselbe Unternehmen
                handelt.
              </p>
            </div>
          ) : null}
          {!loading && candidates.length ? (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">Mögliche bestehende Schuldner</p>
              <div className="mt-3 space-y-2">
                {candidates.map((candidate) => (
                  <label
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${
                      candidate.matchStrength === "STRONG"
                        ? "border-amber-500/60 bg-amber-500/10"
                        : ""
                    }`}
                    key={candidate.id}
                  >
                    <input
                      checked={resolution === "EXISTING" && debtorPartyId === candidate.id}
                      name="candidate"
                      onChange={() => {
                        setResolution("EXISTING");
                        setDebtorPartyId(candidate.id);
                      }}
                      type="radio"
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {candidate.matchStrength === "STRONG"
                          ? "Bestehenden Schuldner verwenden"
                          : "Möglicher bestehender Schuldner"}
                        : {candidate.displayName}
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {candidate.address
                          ? `${candidate.address.street} ${candidate.address.houseNumber || ""}, ${candidate.address.postalCode} ${candidate.address.city}`
                          : "Keine Anschrift"}
                      </span>
                      {candidate.email || candidate.phone ? (
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {[candidate.email, candidate.phone].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {candidate.matchStrength === "STRONG"
                          ? "Sehr wahrscheinliche Dublette"
                          : "Möglicher Treffer"} · Übereinstimmungen: {candidate.matches.join(", ") || "—"} ·{" "}
                        {candidate.caseCount} Akte(n)
                        {candidate.clientRelationships.length
                          ? ` · Mandanten: ${candidate.clientRelationships.join(", ")}`
                          : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <label className="mt-4 flex cursor-pointer gap-3 rounded-lg border p-3">
            <input
              checked={resolution === "NEW"}
              name="candidate"
              onChange={() => {
                setResolution("NEW");
                setDebtorPartyId("");
              }}
              type="radio"
            />
            <span>
              <span className="block font-medium">Als neuen Schuldner anlegen</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Es wird ein neuer Schuldner-Stammsatz aus den Angaben des Mandanten angelegt.
              </span>
            </span>
          </label>
          {resolution === "NEW" &&
          candidates.some((candidate) => candidate.matchStrength === "STRONG") ? (
            <div className="mt-3 rounded-lg border border-amber-500/40 p-4">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Neue Partei trotz möglicher Dublette
              </p>
              <label className="mt-3 flex items-start gap-3 text-sm">
                <input
                  checked={strongMatchOverrideConfirmed}
                  className="mt-0.5"
                  onChange={(event) => setStrongMatchOverrideConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>Trotz möglicher Dublette neuen Schuldner anlegen</span>
              </label>
              <label className="mt-4 grid gap-2 text-sm font-medium">
                Begründung für Neuanlage
                <textarea
                  className="min-h-24 rounded-lg border bg-background p-3 font-normal"
                  disabled={saving}
                  onChange={(event) => setStrongMatchOverrideReason(event.target.value)}
                  value={strongMatchOverrideReason}
                />
              </label>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4">
              <ErrorMessage message={error} />
            </div>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button disabled={saving} variant="outline">
                Abbrechen
              </Button>
            </Dialog.Close>
            <Button disabled={saving || loading} onClick={() => void accept()}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Übernahme läuft …
                </>
              ) : (
                "Annahme bestätigen"
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RejectDialog({
  submission,
  open,
  onOpenChange,
  onRejected,
}: {
  submission: InternalClientSubmission;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRejected: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    if (open) {
      setReason("");
      setError("");
    }
  }, [open]);
  const reject = async () => {
    setSaving(true);
    setError("");
    try {
      await caseApi.rejectClientSubmission(submission.id, reason);
      onOpenChange(false);
      onRejected();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Der Auftrag konnte nicht abgelehnt werden.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 shadow-xl">
          <Dialog.Title className="text-xl font-semibold">Auftrag ablehnen?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            Der Auftrag wird nicht als Inkassoakte übernommen. Ein optionaler Grund bleibt intern.
          </Dialog.Description>
          <label className="mt-5 grid gap-2 text-sm font-medium">
            Ablehnungsgrund (optional)
            <textarea
              className="min-h-28 rounded-lg border bg-background p-3 font-normal"
              onChange={(event) => setReason(event.target.value)}
              value={reason}
            />
          </label>
          {error ? (
            <div className="mt-4">
              <ErrorMessage message={error} />
            </div>
          ) : null}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button disabled={saving} variant="outline">
                Abbrechen
              </Button>
            </Dialog.Close>
            <Button disabled={saving} onClick={() => void reject()}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null} Ablehnung bestätigen
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
      <dd className="whitespace-pre-wrap text-sm font-medium">{value}</dd>
    </div>
  );
}
function debtorName(
  submission: Pick<
    InternalClientSubmission,
    "debtorType" | "debtorFirstName" | "debtorLastName" | "debtorCompanyName"
  >,
) {
  return submission.debtorType === "PERSON"
    ? [submission.debtorFirstName, submission.debtorLastName].filter(Boolean).join(" ") || "—"
    : submission.debtorCompanyName || "—";
}
function address(
  submission: Pick<
    InternalClientSubmission,
    "debtorStreet" | "debtorHouseNumber" | "debtorPostalCode" | "debtorCity" | "debtorCountry"
  >,
) {
  return [
    `${submission.debtorStreet} ${submission.debtorHouseNumber || ""}`.trim(),
    `${submission.debtorPostalCode} ${submission.debtorCity}`,
    submission.debtorCountry,
  ]
    .filter(Boolean)
    .join(", ");
}
