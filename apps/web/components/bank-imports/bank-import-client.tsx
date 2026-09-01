"use client";

import { Download, Search, Upload, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  bankImportApi,
  type BankCaseCandidate,
  type BankImport,
  type BankTransaction,
  type BankTransactionDetail,
  type BankTransactionStatus,
} from "./bank-import-api";

const statusLabels: Record<BankTransactionStatus, string> = {
  IMPORTED: "Importiert",
  MATCHED: "Zugeordnet",
  BOOKED: "Gebucht",
  REVIEW_REQUIRED: "Prüfung erforderlich",
  DUPLICATE: "Duplikat",
  IGNORED: "Ignoriert",
  ERROR: "Fehler",
  PAYMENT_REVERSED: "Zahlung storniert",
};
const importStatusLabels = {
  PROCESSING: "Verarbeitung",
  COMPLETED: "Abgeschlossen",
  COMPLETED_WITH_REVIEW: "Abgeschlossen mit Prüfung",
  FAILED: "Fehlgeschlagen",
} as const;
const reasonLabels: Record<string, string> = {
  EXACT_CASE_REFERENCE: "Eindeutiges Aktenzeichen",
  NO_EXACT_CASE_REFERENCE: "Kein eindeutiges Aktenzeichen",
  AMBIGUOUS_CASE_REFERENCE: "Mehrdeutiges Aktenzeichen",
  UNSUPPORTED_CURRENCY: "Währung wird in P1 nicht gebucht",
  DUPLICATE_TRANSACTION: "Bereits importierte Bankbuchung",
  OUTGOING_TRANSACTION: "Ausgehende Buchung",
  NON_POSITIVE_AMOUNT: "Betrag ist nicht positiv",
  PROCESSING_ERROR: "Technischer Verarbeitungsfehler",
};
const inputClass = "h-10 rounded-lg border border-input bg-background px-3 text-sm";
const date = (value: string) => new Intl.DateTimeFormat("de-DE").format(new Date(value));
const money = (value: string, currency: string) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(Number(value));

function ImportHistory({
  items,
  onDownload,
}: {
  items: BankImport[];
  onDownload: (item: BankImport) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-4">
        <h3 className="font-semibold">Importhistorie</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Datum</th>
              <th className="p-3">Datei</th>
              <th className="p-3">Format</th>
              <th className="p-3">Gesamt</th>
              <th className="p-3">Gebucht</th>
              <th className="p-3">Prüfung</th>
              <th className="p-3">Duplikate</th>
              <th className="p-3">Status</th>
              <th className="p-3">Bearbeiter</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr className="border-t" key={item.id}>
                <td className="p-3">{date(item.importedAt)}</td>
                <td className="p-3 font-medium">{item.fileName}</td>
                <td className="p-3">{item.fileFormat.replace("_", ".")}</td>
                <td className="p-3">{item.transactionCount}</td>
                <td className="p-3">{item.bookedCount}</td>
                <td className="p-3">{item.reviewCount}</td>
                <td className="p-3">{item.duplicateCount}</td>
                <td className="p-3">{importStatusLabels[item.status]}</td>
                <td className="p-3">
                  {item.importedBy.user.displayName ?? item.importedBy.user.email}
                </td>
                <td className="p-3">
                  <Button
                    className="h-8 px-3 text-xs"
                    onClick={() => onDownload(item)}
                    variant="outline"
                  >
                    <Download className="mr-1 size-4" />
                    Original
                  </Button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td className="p-8 text-center text-muted-foreground" colSpan={10}>
                  Noch keine Bankimporte vorhanden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TransactionTable({
  items,
  onOpen,
}: {
  items: BankTransaction[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="p-3">Buchung</th>
            <th className="p-3">Betrag</th>
            <th className="p-3">Absender</th>
            <th className="p-3">Verwendungszweck</th>
            <th className="p-3">Status</th>
            <th className="p-3">Zuordnung</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr className="border-t" key={item.id}>
              <td className="p-3">{date(item.bookingDate)}</td>
              <td className="p-3 font-semibold">{money(item.amount, item.currency)}</td>
              <td className="p-3">
                <p>{item.debtorName ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{item.debtorIban ?? "Keine IBAN"}</p>
              </td>
              <td className="max-w-md p-3">
                <p className="line-clamp-2">{item.purpose || "—"}</p>
              </td>
              <td className="p-3">{statusLabels[item.status]}</td>
              <td className="p-3">
                {item.matchedCase?.caseNumber ?? reasonLabels[item.matchReason ?? ""] ?? "—"}
              </td>
              <td className="p-3 text-right">
                <Button
                  className="h-8 px-3 text-xs"
                  onClick={() => onOpen(item.id)}
                  variant="outline"
                >
                  Details
                </Button>
              </td>
            </tr>
          ))}
          {!items.length ? (
            <tr>
              <td className="p-8 text-center text-muted-foreground" colSpan={7}>
                Keine Bankbuchungen für diese Auswahl.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Candidate({
  item,
  selected,
  onSelect,
}: {
  item: BankCaseCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`w-full rounded-lg border p-3 text-left text-sm transition ${selected ? "border-primary bg-primary/5" : "hover:bg-muted"}`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex justify-between gap-3">
        <span className="font-medium">
          {item.caseNumber} · {item.debtorName}
        </span>
        <span>{money(item.openAmount, item.currency)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Mandant: {item.clientName}</p>
    </button>
  );
}

function TransactionDialog({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = React.useState<BankTransactionDetail | null>(null);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<BankCaseCandidate[]>([]);
  const [selected, setSelected] = React.useState("");
  const [ignoreReason, setIgnoreReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    setError("");
    void bankImportApi
      .transaction(id)
      .then((value) => {
        setItem(value);
        setResults(value.candidates);
        setSelected(value.matchedCase?.id ?? "");
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);
  React.useEffect(load, [load]);
  const run = (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    void operation()
      .then(() => {
        onChanged();
        load();
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setBusy(false));
  };
  const find = () => {
    if (search.trim().length < 2) {
      setError("Bitte mindestens zwei Zeichen eingeben.");
      return;
    }
    setBusy(true);
    setError("");
    void bankImportApi
      .searchCases(search.trim())
      .then(setResults)
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setBusy(false));
  };
  if (!item)
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4">
        <div className="rounded-xl border bg-card p-6">{error || "Bankbuchung wird geladen …"}</div>
      </div>
    );
  const actionable = item.status === "REVIEW_REQUIRED" || item.status === "MATCHED";
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4">
      <div className="max-h-[94vh] w-full max-w-4xl space-y-5 overflow-auto rounded-2xl border bg-card p-6 shadow-xl">
        <header className="flex justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Zahlungszuordnung</p>
            <h3 className="text-2xl font-semibold">{money(item.amount, item.currency)}</h3>
            <p className="text-sm text-muted-foreground">
              {date(item.bookingDate)} · {statusLabels[item.status]}
            </p>
          </div>
          <Button disabled={busy} onClick={onClose} variant="outline">
            <X className="size-4" />
          </Button>
        </header>
        <section className="grid gap-4 rounded-xl border p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Absender</p>
            <p className="font-medium">{item.debtorName ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">IBAN</p>
            <p className="font-medium">{item.debtorIban ?? "—"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Verwendungszweck</p>
            <p className="whitespace-pre-wrap font-medium">{item.purpose || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bankreferenz</p>
            <p>{item.bankReference ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">End-to-End-ID</p>
            <p>{item.endToEndId ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Match</p>
            <p>
              {reasonLabels[item.matchReason ?? ""] ?? item.matchReason ?? "—"}
              {item.matchScore !== null ? ` · ${item.matchScore}` : ""}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Zahlung</p>
            <p>{item.payment ? `${item.payment.id} · ${item.payment.status}` : "Nicht gebucht"}</p>
          </div>
        </section>
        {actionable ? (
          <section className="space-y-3 rounded-xl border p-4">
            <h4 className="font-semibold">Akte zuordnen</h4>
            <div className="flex gap-2">
              <input
                className={`${inputClass} min-w-0 flex-1`}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Aktenzeichen oder Schuldnername"
                value={search}
              />
              <Button disabled={busy} onClick={find} variant="outline">
                <Search className="mr-1 size-4" />
                Suchen
              </Button>
            </div>
            <div className="space-y-2">
              {results.map((candidate) => (
                <Candidate
                  item={candidate}
                  key={candidate.id}
                  onSelect={() => setSelected(candidate.id)}
                  selected={selected === candidate.id}
                />
              ))}
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex min-w-[20rem] flex-1 gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  onChange={(event) => setIgnoreReason(event.target.value)}
                  placeholder="Begründung für Ignorieren"
                  value={ignoreReason}
                />
                <Button
                  disabled={busy || ignoreReason.trim().length < 3}
                  onClick={() => run(() => bankImportApi.ignore(id, ignoreReason))}
                  variant="outline"
                >
                  Ignorieren
                </Button>
              </div>
              <Button
                disabled={busy || !selected}
                onClick={() => {
                  if (
                    window.confirm(
                      "Zahlung der ausgewählten Akte zuordnen und nach § 367 BGB buchen?",
                    )
                  )
                    run(() => bankImportApi.book(id, selected));
                }}
              >
                Akte zuordnen und Zahlung buchen
              </Button>
            </div>
          </section>
        ) : null}
        {error ? (
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

export function BankImportClient() {
  const [imports, setImports] = React.useState<BankImport[]>([]);
  const [transactions, setTransactions] = React.useState<BankTransaction[]>([]);
  const [status, setStatus] = React.useState<BankTransactionStatus | "">("");
  const [importId, setImportId] = React.useState("");
  const [bookingFrom, setBookingFrom] = React.useState("");
  const [bookingTo, setBookingTo] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    void Promise.all([
      bankImportApi.imports(),
      bankImportApi.transactions({
        status: status || undefined,
        importId: importId || undefined,
        bookingFrom: bookingFrom || undefined,
        bookingTo: bookingTo || undefined,
      }),
    ])
      .then(([history, items]) => {
        setImports(history);
        setTransactions(items);
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [status, importId, bookingFrom, bookingTo]);
  React.useEffect(load, [load]);
  const upload = () => {
    if (!file) {
      setError("Bitte eine CAMT-XML-Datei auswählen.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    void bankImportApi
      .upload(file)
      .then((item) => {
        setSuccess(
          `${item.fileName}: ${item.bookedCount} gebucht, ${item.reviewCount} zu prüfen, ${item.duplicateCount} Duplikate.`,
        );
        setFile(null);
        load();
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setBusy(false));
  };
  const download = (item: BankImport) => {
    setBusy(true);
    setError("");
    void bankImportApi
      .downloadImport(item)
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setBusy(false));
  };
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">payveo · Arbeitsbereich</p>
        <h2 className="text-3xl font-semibold">Bankimport</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CAMT-Zahlungseingänge sicher importieren, automatisch abgleichen und offene Zuordnungen
          prüfen.
        </p>
      </header>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold">Bankdatei importieren</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Akzeptiert: CAMT.053 und CAMT.054 als XML, maximal 5 MB.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            accept=".xml,application/xml,text/xml"
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
          <Button disabled={busy || !file} onClick={upload}>
            <Upload className="mr-2 size-4" />
            {busy ? "Importiert …" : "Bankdatei importieren"}
          </Button>
        </div>
        {success ? (
          <p className="mt-3 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </p>
        ) : null}
      </section>
      {error ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      ) : null}
      <ImportHistory items={imports} onDownload={download} />
      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Zahlungszuordnung</h3>
          <p className="text-sm text-muted-foreground">
            Unsichere Treffer bleiben ungebucht, bis sie geprüft wurden.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className={inputClass}
            onChange={(event) => setStatus(event.target.value as BankTransactionStatus | "")}
            value={status}
          >
            <option value="">Alle Status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={inputClass}
            onChange={(event) => setImportId(event.target.value)}
            value={importId}
          >
            <option value="">Alle Importe</option>
            {imports.map((item) => (
              <option key={item.id} value={item.id}>
                {item.fileName}
              </option>
            ))}
          </select>
          <input
            className={inputClass}
            onChange={(event) => setBookingFrom(event.target.value)}
            type="date"
            value={bookingFrom}
          />
          <input
            className={inputClass}
            onChange={(event) => setBookingTo(event.target.value)}
            type="date"
            value={bookingTo}
          />
          <Button
            onClick={() => setStatus("REVIEW_REQUIRED")}
            variant={status === "REVIEW_REQUIRED" ? "default" : "outline"}
          >
            Zu prüfen
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Bankbuchungen werden geladen …</p>
        ) : (
          <TransactionTable items={transactions} onOpen={setSelected} />
        )}
      </section>
      {selected ? (
        <TransactionDialog id={selected} onChanged={load} onClose={() => setSelected(null)} />
      ) : null}
    </section>
  );
}
