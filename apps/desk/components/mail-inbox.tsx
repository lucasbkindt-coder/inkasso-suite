"use client";

import { Loader2, MailOpen, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { deskMailApi, type Paged, type InboxMessage } from "@/lib/desk-mail-api";
import { fieldClass, formatDate } from "./ticket-ui";

export function MailInbox() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = React.useState<Paged<InboxMessage> | null>(null);
  const [search, setSearch] = React.useState(params.get("search") ?? "");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const key = params.toString();

  React.useEffect(() => {
    setLoading(true);
    setError("");
    void deskMailApi
      .inbox(new URLSearchParams(key))
      .then(setData)
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : "Posteingang konnte nicht geladen werden.",
        ),
      )
      .finally(() => setLoading(false));
  }, [key]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (search.trim()) next.set("search", search.trim());
    else next.delete("search");
    next.set("page", "1");
    router.push(`/inbox?${next.toString()}`);
  }

  async function open(message: InboxMessage) {
    const ticket = message.communicationEvent.deskTicket;
    if (!ticket) return;
    if (ticket.unreadAt) await deskMailApi.markRead(ticket.id).catch(() => undefined);
    router.push(`/tickets/${ticket.id}`);
  }

  return (
    <section className="space-y-5">
      <header>
        <p className="text-sm font-medium text-primary">Desk · E-Mail</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Posteingang</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tenantgebundene, sicher importierte E-Mails aus konfigurierten Mailkonten.
        </p>
      </header>
      <form
        className="relative max-w-xl rounded-2xl border bg-card p-4 shadow-sm"
        onSubmit={submit}
      >
        <Search className="absolute left-7 top-7 size-4 text-muted-foreground" />
        <input
          className={`${fieldClass} pl-9`}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Absender, Betreff, Ticketnummer"
          value={search}
        />
      </form>
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {loading ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            E-Mails werden geladen …
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {[
                    "Status",
                    "Absender",
                    "Betreff",
                    "Ticket",
                    "Partei",
                    "Akte",
                    "Bearbeiter",
                    "Zeit",
                  ].map((label) => (
                    <th className="px-4 py-3 font-medium" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.items.map((message) => {
                  const ticket = message.communicationEvent.deskTicket;
                  return (
                    <tr
                      className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                      key={message.id}
                      onClick={() => void open(message)}
                    >
                      <td className="px-4 py-3">
                        {ticket?.unreadAt ? (
                          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                            Ungelesen
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Gelesen</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{message.fromAddress}</td>
                      <td className="max-w-80 px-4 py-3">{message.subject}</td>
                      <td className="px-4 py-3">
                        {ticket ? (
                          <Link
                            className="font-semibold text-primary"
                            href={`/tickets/${ticket.id}`}
                          >
                            {ticket.number}
                          </Link>
                        ) : (
                          "Review"
                        )}
                      </td>
                      <td className="px-4 py-3">{ticket?.party?.displayName ?? "—"}</td>
                      <td className="px-4 py-3">{ticket?.case?.caseNumber ?? "—"}</td>
                      <td className="px-4 py-3">
                        {ticket?.assigneeMembership?.user.displayName ??
                          ticket?.assigneeMembership?.user.email ??
                          "Nicht zugewiesen"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(message.receivedAt)}
                      </td>
                    </tr>
                  );
                })}
                {!data?.items.length ? (
                  <tr>
                    <td className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                      <MailOpen className="mx-auto mb-2 size-5" />
                      Keine E-Mails für diese Auswahl.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && data.totalPages > 1 ? (
        <footer className="text-sm text-muted-foreground">
          Seite {data.page} von {data.totalPages} · {data.total} E-Mails
        </footer>
      ) : null}
    </section>
  );
}
