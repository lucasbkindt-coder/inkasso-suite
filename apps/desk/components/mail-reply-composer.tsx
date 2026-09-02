"use client";

import { FileUp, Loader2, Mail, Save, Send } from "lucide-react";
import * as React from "react";

import {
  deskMailApi,
  type CannedResponse,
  type MailAccount,
  type MailDraft,
} from "@/lib/desk-mail-api";
import type { DeskTicketDetail } from "@/lib/desk-api";
import { fieldClass, textareaClass } from "./ticket-ui";

export function MailReplyComposer({
  ticket,
  onChanged,
}: {
  ticket: DeskTicketDetail;
  onChanged(): Promise<unknown>;
}) {
  const latestInbound = ticket.communications.find(
    (item) => item.mailMessage?.direction === "INBOUND",
  )?.mailMessage;
  const [accounts, setAccounts] = React.useState<MailAccount[]>([]);
  const [drafts, setDrafts] = React.useState<MailDraft[]>([]);
  const [canned, setCanned] = React.useState<CannedResponse[]>([]);
  const [accountId, setAccountId] = React.useState("");
  const [to, setTo] = React.useState(latestInbound?.fromAddress ?? "");
  const [cc, setCc] = React.useState("");
  const [subject, setSubject] = React.useState(
    ticket.subject.startsWith("Re:") ? ticket.subject : `Re: ${ticket.subject}`,
  );
  const [body, setBody] = React.useState("");
  const [current, setCurrent] = React.useState<MailDraft | null>(null);
  const [files, setFiles] = React.useState<File[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const load = React.useCallback(
    () =>
      Promise.all([
        deskMailApi.accounts(),
        deskMailApi.drafts(ticket.id),
        deskMailApi.cannedResponses(),
      ]).then(([accountValues, draftValues, cannedValues]) => {
        setAccounts(accountValues);
        setDrafts(draftValues);
        setCanned(cannedValues);
        setAccountId(
          (value) =>
            value || accountValues.find((item) => item.isDefault)?.id || accountValues[0]?.id || "",
        );
      }),
    [ticket.id],
  );
  React.useEffect(() => {
    void load().catch((cause) =>
      setError(
        cause instanceof Error ? cause.message : "Mailentwürfe konnten nicht geladen werden.",
      ),
    );
  }, [load]);

  function addresses(value: string) {
    return value
      .split(/[;,]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  function chooseDraft(value: MailDraft) {
    setCurrent(value);
    setAccountId(
      accounts.find((item) => item.emailAddress === value.mailAccount.emailAddress)?.id ??
        accountId,
    );
    setTo(value.toAddresses.join(", "));
    setCc(value.ccAddresses.join(", "));
    setSubject(value.subject);
    setBody(value.bodyPlain);
    setFiles([]);
    setSuccess("");
  }
  async function save() {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const saved = current
        ? await deskMailApi.updateDraft(current.id, {
            version: current.version,
            toAddresses: addresses(to),
            ccAddresses: addresses(cc),
            subject,
            bodyPlain: body,
          })
        : await deskMailApi.createDraft({
            ticketId: ticket.id,
            mailAccountId: accountId,
            toAddresses: addresses(to),
            ccAddresses: addresses(cc),
            subject,
            bodyPlain: body,
          });
      if (files.length) await deskMailApi.addAttachments(saved.id, files);
      setCurrent(saved);
      setFiles([]);
      setSuccess("Entwurf wurde serverseitig gespeichert.");
      await load();
      await onChanged();
      return saved;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Entwurf konnte nicht gespeichert werden.");
      return null;
    } finally {
      setPending(false);
    }
  }
  async function queue() {
    const saved = await save();
    if (!saved) return;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const job = await deskMailApi.queue(saved.id);
      const result = await deskMailApi.process(job.id);
      setSuccess(
        result.status === "SENT"
          ? "E-Mail wurde über den freigegebenen Mock-/Log-Transport versendet."
          : "Versand fehlgeschlagen; der begrenzte Retry wurde eingeplant.",
      );
      setCurrent(null);
      setBody("");
      await load();
      await onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "E-Mail konnte nicht in die Versandqueue gestellt werden.",
      );
    } finally {
      setPending(false);
    }
  }
  const activeAccounts = accounts.filter(
    (item) => item.status === "ACTIVE" && item.outboundEnabled,
  );
  return (
    <article className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Mail className="size-5 text-primary" />
            E-Mail-Antwort
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Externe Antwort – vollständig getrennt von internen Notizen.
          </p>
        </div>
        {drafts.length ? (
          <select
            aria-label="Gespeicherten Entwurf öffnen"
            className={`${fieldClass} w-auto min-w-56`}
            onChange={(event) => {
              const value = drafts.find((item) => item.id === event.target.value);
              if (value) chooseDraft(value);
            }}
            value={current?.id ?? ""}
          >
            <option value="">Gespeicherten Entwurf öffnen</option>
            {drafts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.status} · {item.subject}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {!accounts.length ? (
        <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          Kein Mailkonto konfiguriert. Der normale Desk-Betrieb bleibt verfügbar.
        </p>
      ) : (
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            Absenderkonto
            <select
              className={fieldClass}
              disabled={pending || Boolean(current)}
              onChange={(event) => setAccountId(event.target.value)}
              value={accountId}
            >
              {accounts.map((item) => (
                <option disabled={item.status !== "ACTIVE"} key={item.id} value={item.id}>
                  {item.name} · {item.emailAddress} · {item.status}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              An
              <input
                className={fieldClass}
                disabled={pending}
                onChange={(event) => setTo(event.target.value)}
                placeholder="name@beispiel.de"
                value={to}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Cc optional
              <input
                className={fieldClass}
                disabled={pending}
                onChange={(event) => setCc(event.target.value)}
                value={cc}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Betreff
            <input
              className={fieldClass}
              disabled={pending}
              maxLength={998}
              onChange={(event) => setSubject(event.target.value)}
              value={subject}
            />
          </label>
          {canned.length ? (
            <label className="grid gap-1.5 text-sm font-medium">
              Antwortvorlage
              <select
                className={fieldClass}
                disabled={pending}
                onChange={(event) => {
                  const value = canned.find((item) => item.id === event.target.value);
                  if (value) {
                    if (value.subject) setSubject(value.subject);
                    setBody(value.body);
                  }
                }}
                value=""
              >
                <option value="">Vorlage auswählen …</option>
                {canned.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1.5 text-sm font-medium">
            Text
            <textarea
              className={`${textareaClass} min-h-56`}
              disabled={pending}
              maxLength={100000}
              onChange={(event) => setBody(event.target.value)}
              value={body}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <FileUp className="size-4" />
            <span>
              {files.length
                ? `${files.length} Datei(en) ausgewählt`
                : "Anhänge auswählen (max. 10 × 10 MB)"}
            </span>
            <input
              className="sr-only"
              disabled={pending}
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              type="file"
            />
          </label>
        </div>
      )}
      {ticket.party?.processingRestrictedAt ? (
        <p className="mt-4 rounded-lg bg-amber-500/10 p-3 text-sm font-medium text-amber-800 dark:text-amber-200">
          Verarbeitung eingeschränkt: Speichern ist möglich, die Versandfreigabe wird serverseitig
          blockiert.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mt-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-medium disabled:opacity-50"
          disabled={pending || !accountId || !to.trim() || !subject.trim() || !body.trim()}
          onClick={() => void save()}
          type="button"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Entwurf speichern
        </button>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          disabled={
            pending ||
            !activeAccounts.some((item) => item.id === accountId) ||
            !to.trim() ||
            !subject.trim() ||
            !body.trim()
          }
          onClick={() => void queue()}
          type="button"
        >
          <Send className="size-4" />
          Versand freigeben
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Technische Thread-Header werden ausschließlich serverseitig aus dem letzten
        Nachrichtenthread gebildet. Optimistische Versionsprüfung schützt Entwürfe vor stillen
        Überschreibungen.
      </p>
    </article>
  );
}
