"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import * as React from "react";

import { deskMailApi, type MailReview, type Paged } from "@/lib/desk-mail-api";
import type { DeskCaseOption, DeskPartyOption } from "@/lib/desk-api";
import { CasePicker, formatDate, PartyPicker } from "./ticket-ui";

const reasons: Record<MailReview["reason"], string> = {
  PARTY_AMBIGUOUS: "Partei nicht eindeutig",
  CASE_AMBIGUOUS: "Akte nicht eindeutig",
  THREAD_AMBIGUOUS: "Thread nicht eindeutig",
  MALFORMED_MAIL: "Fehlerhafte E-Mail",
  BLOCKED_ATTACHMENT: "Anhang blockiert",
  PROCESSING_RESTRICTION: "Verarbeitung eingeschränkt",
  UNMATCHED_CONTEXT: "Zuordnung offen",
};

export function MailReviewQueue() {
  const [data, setData] = React.useState<Paged<MailReview> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(() => {
    setLoading(true);
    setError("");
    return deskMailApi
      .reviews(new URLSearchParams({ status: "PENDING" }))
      .then(setData)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Review-Queue konnte nicht geladen werden.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="space-y-5">
      <header>
        <p className="text-sm font-medium text-primary">Desk · E-Mail</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Review</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unklare Zuordnungen werden ausschließlich nach manueller Prüfung übernommen.
        </p>
      </header>
      {error ? (
        <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Review-Einträge werden geladen …
        </p>
      ) : (
        <div className="space-y-4">
          {data?.items.map((item) => (
            <ReviewCard item={item} key={item.id} onDone={load} />
          ))}
          {!data?.items.length ? (
            <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
              <ShieldAlert className="mx-auto mb-2 size-6" />
              Keine offenen Review-Einträge.
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ReviewCard({ item, onDone }: { item: MailReview; onDone(): Promise<unknown> }) {
  const [party, setParty] = React.useState<DeskPartyOption | null>(
    item.suggestedParty ? { ...item.suggestedParty, type: "PERSON", roles: [] } : null,
  );
  const [record, setRecord] = React.useState<DeskCaseOption | null>(
    item.suggestedCase
      ? {
          ...item.suggestedCase,
          clientParty: { id: "", displayName: "" },
          debtorParty: { id: "", displayName: "" },
        }
      : null,
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  async function resolve(ignored: boolean) {
    setPending(true);
    setError("");
    try {
      await deskMailApi.resolveReview(item.id, {
        ticketId: item.deskTicket?.id,
        partyId: party?.id,
        caseId: record?.id,
        ignored,
      });
      await onDone();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Review konnte nicht abgeschlossen werden.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200">
            {reasons[item.reason]}
          </span>
          <h2 className="mt-3 font-semibold">
            {item.mailMessage?.subject ?? item.deskTicket?.subject ?? "Nicht lesbare E-Mail"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.mailMessage?.fromAddress ?? "Absender unbekannt"} ·{" "}
            {formatDate(item.mailMessage?.receivedAt ?? item.createdAt)}
          </p>
        </div>
        {item.deskTicket ? (
          <p className="font-mono text-sm text-primary">{item.deskTicket.number}</p>
        ) : null}
      </div>
      <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">{item.summary}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-medium">
          Partei
          <PartyPicker disabled={pending} onSelect={setParty} selected={party} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium">
          Inkassoakte
          <CasePicker disabled={pending} onSelect={setRecord} selected={record} />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={pending || !item.deskTicket}
          onClick={() => void resolve(false)}
          type="button"
        >
          Zuordnung übernehmen
        </button>
        <button
          className="rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50"
          disabled={pending}
          onClick={() => void resolve(true)}
          type="button"
        >
          Ignorieren
        </button>
      </div>
    </article>
  );
}
