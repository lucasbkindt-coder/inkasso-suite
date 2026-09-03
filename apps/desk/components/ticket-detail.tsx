"use client";

import { ArrowLeft, Loader2, Paperclip, Phone, Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { DeskSessionContext } from "./desk-auth-gate";
import {
  CasePicker,
  fieldClass,
  formatDate,
  PartyPicker,
  PriorityBadge,
  StatusBadge,
  textareaClass,
} from "./ticket-ui";
import {
  deskApi,
  priorityLabels,
  statusLabels,
  type DeskCaseOption,
  type DeskOptions,
  type DeskPartyOption,
  type DeskTicketDetail,
  type DeskTicketPriority,
  type DeskTicketStatus,
} from "@/lib/desk-api";
import { deskMailApi } from "@/lib/desk-mail-api";
import { telephonyApi } from "@/lib/telephony-api";
import { MailReplyComposer } from "./mail-reply-composer";

export function TicketDetailView() {
  const { id } = useParams<{ id: string }>();
  const session = React.useContext(DeskSessionContext);
  const [ticket, setTicket] = React.useState<DeskTicketDetail | null>(null);
  const [options, setOptions] = React.useState<DeskOptions | null>(null);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [phone, setPhone] = React.useState<string | null>(null);
  const canManage = session?.permissions.includes("desk:manage") ?? false;
  const canAssign = session?.permissions.includes("desk:assign") ?? false;
  const canCall = session?.permissions.includes("desk:telephony:use") ?? false;
  const load = React.useCallback(() => {
    setError("");
    return Promise.all([deskApi.ticket(id), deskApi.options()])
      .then(([value, selectable]) => {
        setTicket(value);
        setOptions(selectable);
        if (value.partyId) {
          void deskApi
            .partyContext(value.partyId)
            .then((context) => setPhone(context.contacts[0]?.value ?? null))
            .catch(() => setPhone(null));
        } else setPhone(null);
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "Ticket konnte nicht geladen werden."),
      );
  }, [id]);
  React.useEffect(() => {
    void load();
  }, [load]);
  async function update(payload: Omit<Parameters<typeof deskApi.update>[1], "expectedVersion">) {
    setPending(true);
    setError("");
    try {
      await deskApi.update(id, { ...payload, expectedVersion: ticket?.version ?? 0 });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ticket konnte nicht aktualisiert werden.");
    } finally {
      setPending(false);
    }
  }
  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    setPending(true);
    setError("");
    try {
      await deskApi.addNote(id, note.trim());
      setNote("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Notiz konnte nicht gespeichert werden.");
    } finally {
      setPending(false);
    }
  }
  if (error && !ticket)
    return (
      <p className="rounded-xl bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">{error}</p>
    );
  if (!ticket)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Ticket wird geladen …
      </p>
    );
  const selectedParty: DeskPartyOption | null = ticket.party
    ? {
        id: ticket.party.id,
        displayName: ticket.party.displayName,
        type: ticket.party.type,
        roles: [],
      }
    : null;
  const selectedCase: DeskCaseOption | null = ticket.case
    ? {
        id: ticket.case.id,
        caseNumber: ticket.case.caseNumber,
        clientParty: { id: "", displayName: "" },
        debtorParty: { id: "", displayName: "" },
      }
    : null;
  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        href="/tickets"
      >
        <ArrowLeft className="size-4" />
        Tickets
      </Link>
      <header className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-primary">{ticket.number}</span>
              <StatusBadge value={ticket.status} />
              <PriorityBadge value={ticket.priority} />
              {ticket.unreadAt ? (
                <button
                  className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
                  disabled={pending}
                  onClick={() => {
                    setPending(true);
                    void deskMailApi
                      .markRead(ticket.id)
                      .then(load)
                      .catch((cause) =>
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Ticket konnte nicht als gelesen markiert werden.",
                        ),
                      )
                      .finally(() => setPending(false));
                  }}
                  type="button"
                >
                  Als gelesen markieren
                </button>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {ticket.subject}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Aktualisiert {formatDate(ticket.updatedAt)} · Version {ticket.version}
            </p>
          </div>
          <div className="grid min-w-52 gap-2">
            <select
              aria-label="Status"
              className={fieldClass}
              disabled={!canManage || pending}
              onChange={(event) => void update({ status: event.target.value as DeskTicketStatus })}
              value={ticket.status}
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Priorität"
              className={fieldClass}
              disabled={!canManage || pending}
              onChange={(event) =>
                void update({ priority: event.target.value as DeskTicketPriority })
              }
              value={ticket.priority}
            >
              {Object.entries(priorityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Optimistische Versionsprüfung aktiv: parallele Änderungen werden erkannt und nicht still
          überschrieben.
        </p>
        {error ? (
          <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </header>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <article className="rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Verlauf</h2>
            <div className="mt-5 space-y-4">
              {ticket.communications.map((item) => {
                const label = item.telephonyCall
                  ? item.telephonyCall.direction === "INBOUND"
                    ? "Eingehender Anruf"
                    : "Ausgehender Anruf"
                  : item.direction === "INTERNAL"
                    ? "Interne Notiz"
                    : item.direction === "INBOUND"
                      ? "Eingehende E-Mail"
                      : item.mailDraft?.status === "DRAFT"
                        ? "E-Mail-Entwurf"
                        : "Ausgehende E-Mail";
                const author =
                  item.createdByMembership?.user.displayName ??
                  item.createdByMembership?.user.email ??
                  "System";
                return (
                  <div
                    className={`rounded-xl border p-4 ${item.direction === "INTERNAL" ? "bg-amber-500/5" : item.direction === "INBOUND" ? "bg-sky-500/5" : "bg-emerald-500/5"}`}
                    key={item.id}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">
                        {label} · {author}
                      </p>
                      <time className="text-xs text-muted-foreground">
                        {formatDate(item.occurredAt)}
                      </time>
                    </div>
                    {item.mailMessage ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Von {item.mailMessage.fromAddress} · An{" "}
                        {item.mailMessage.toAddresses.join(", ")} ·{" "}
                        {item.mailMessage.deliveryStatus}
                      </p>
                    ) : null}
                    {item.subject ? (
                      <p className="mt-2 text-sm font-medium">{item.subject}</p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.summary}</p>
                    {item.attachments.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.attachments.map((attachment) => (
                          <a
                            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"
                            href={`/api/desk/tickets/${ticket.id}/communications/${item.id}/attachments/${attachment.id}/download`}
                            key={attachment.id}
                          >
                            <Paperclip className="size-3.5" />
                            {attachment.originalFileName}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!ticket.communications.length ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Kommunikation dokumentiert.
                </p>
              ) : null}
            </div>
            {canManage ? (
              <form className="mt-6 border-t pt-5" onSubmit={addNote}>
                <label className="grid gap-2 text-sm font-medium">
                  Interne Notiz
                  <textarea
                    className={textareaClass}
                    disabled={pending}
                    maxLength={20000}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Nur intern sichtbar – wird niemals als E-Mail versendet."
                    value={note}
                  />
                </label>
                <button
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  disabled={pending || !note.trim()}
                  type="submit"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Interne Notiz speichern
                </button>
              </form>
            ) : null}
          </article>
          {canManage ? <MailReplyComposer onChanged={load} ticket={ticket} /> : null}
        </div>
        <aside className="space-y-5">
          <ContextCard title="Zuordnung">
            <label className="grid gap-1.5 text-sm font-medium">
              Bearbeiter
              <select
                className={fieldClass}
                disabled={!canAssign || pending}
                onChange={(event) =>
                  void update({ assigneeMembershipId: event.target.value || null })
                }
                value={ticket.assigneeMembershipId ?? ""}
              >
                <option value="">Nicht zugewiesen</option>
                {options?.memberships.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Team
              <select
                className={fieldClass}
                disabled={!canAssign || pending}
                onChange={(event) => void update({ teamId: event.target.value || null })}
                value={ticket.teamId ?? ""}
              >
                <option value="">Kein Team</option>
                {options?.teams.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </ContextCard>
          <ContextCard title="Fachlicher Kontext">
            {canCall && phone ? (
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-50"
                disabled={pending || Boolean(ticket.party?.processingRestrictedAt)}
                onClick={() => {
                  setPending(true);
                  setError("");
                  void telephonyApi
                    .outgoing({
                      remoteNumber: phone,
                      partyId: ticket.partyId ?? undefined,
                      caseId: ticket.caseId ?? undefined,
                      ticketId: ticket.id,
                    })
                    .then((call) =>
                      window.open(`/calls/${call.id}`, "_blank", "noopener,noreferrer"),
                    )
                    .catch((cause) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Anruf konnte nicht gestartet werden.",
                      ),
                    )
                    .finally(() => setPending(false));
                }}
                type="button"
              >
                <Phone className="size-4" />
                {phone} anrufen
              </button>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium">
              Partei
              <PartyPicker
                disabled={!canManage || pending}
                onSelect={(value) => void update({ partyId: value?.id ?? null })}
                selected={selectedParty}
              />
            </label>
            {ticket.party?.processingRestrictedAt ? (
              <p className="rounded-lg bg-amber-500/10 p-3 text-xs font-medium text-amber-800 dark:text-amber-200">
                Verarbeitung eingeschränkt. Ein Entwurf ist möglich, der Versand wird serverseitig
                blockiert.
              </p>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium">
              Inkassoakte
              <CasePicker
                disabled={!canManage || pending}
                onSelect={(value) => void update({ caseId: value?.id ?? null })}
                selected={selectedCase}
              />
            </label>
          </ContextCard>
          <ContextCard title="Offene Aufgaben">
            {ticket.openTasks.map((task) => (
              <div className="rounded-lg border p-3 text-sm" key={task.id}>
                <p className="font-medium">{task.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.dueAt ? `Fällig ${formatDate(task.dueAt)}` : "Ohne Fälligkeit"} ·{" "}
                  {task.status}
                </p>
              </div>
            ))}
            {!ticket.openTasks.length ? (
              <p className="text-sm text-muted-foreground">Keine offenen Aufgaben zur Akte.</p>
            ) : null}
          </ContextCard>
        </aside>
      </div>
    </section>
  );
}

function ContextCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <article className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </article>
  );
}
