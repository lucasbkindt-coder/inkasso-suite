"use client";

import { ExternalLink, Link2, Loader2, Search, Unlink } from "lucide-react";
import * as React from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { staffAuthApi } from "@/lib/staff-auth-api";

import { zohoDeskApi, type ZohoDeskTicket, type ZohoDeskTicketLink } from "./zoho-desk-api";

export function ZohoCasePanel({ caseId }: { caseId: string }) {
  const [links, setLinks] = React.useState<ZohoDeskTicketLink[]>([]);
  const [results, setResults] = React.useState<ZohoDeskTicket[]>([]);
  const [query, setQuery] = React.useState("");
  const [canRead, setCanRead] = React.useState(false);
  const [canManage, setCanManage] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void staffAuthApi
      .session()
      .then(async (session) => {
        const readable = session.permissions.includes("integration:read");
        setCanRead(readable);
        setCanManage(session.permissions.includes("integration:manage"));
        if (readable) setLinks(await zohoDeskApi.caseLinks(caseId));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [caseId]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError("Bitte geben Sie mindestens zwei Zeichen ein.");
      return;
    }
    setPending(true);
    setError("");
    try {
      setResults(await zohoDeskApi.searchTickets(query.trim()));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Zoho-Tickets konnten nicht gesucht werden.",
      );
    } finally {
      setPending(false);
    }
  }

  async function connect(externalId: string) {
    setPending(true);
    setError("");
    try {
      const link = await zohoDeskApi.linkCase(caseId, externalId);
      setLinks((current) => [link, ...current]);
      setResults([]);
      setQuery("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Das Zoho-Ticket konnte nicht verknüpft werden.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disconnect(link: ZohoDeskTicketLink) {
    if (!window.confirm("Zoho-Ticketverknüpfung wirklich entfernen?")) return;
    setPending(true);
    setError("");
    try {
      await zohoDeskApi.unlinkCase(caseId, link.id);
      setLinks((current) => current.filter((item) => item.id !== link.id));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Die Zoho-Verknüpfung konnte nicht entfernt werden.",
      );
    } finally {
      setPending(false);
    }
  }

  if (loading || !canRead) return null;

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-primary">Integration</p>
        <h3 className="mt-1 font-semibold">Zoho Desk</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Manuell verknüpfte Tickets für diese Inkassoakte.
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {links.length ? (
        <div className="mt-5 space-y-3">
          {links.map((link) => (
            <article
              className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4"
              key={link.id}
            >
              <div className="min-w-0">
                <p className="font-medium">{link.metadata?.subject ?? "Verknüpftes Zoho-Ticket"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ticket {link.metadata?.ticketNumber ?? link.externalId} ·{" "}
                  {link.metadata?.status ?? "Status unbekannt"}
                </p>
                {link.metadata?.contact?.name ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kontakt: {link.metadata.contact.name}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">Externe ID: {link.externalId}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {link.webUrl ? (
                  <a
                    className={cn(buttonVariants({ variant: "outline" }), "h-9")}
                    href={link.webUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink className="size-4" /> In Zoho öffnen
                  </a>
                ) : null}
                {canManage ? (
                  <Button
                    className="h-9"
                    disabled={pending}
                    onClick={() => void disconnect(link)}
                    variant="outline"
                  >
                    <Unlink className="size-4" /> Entfernen
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Noch kein Zoho-Ticket verknüpft.</p>
      )}

      {canManage ? (
        <>
          <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={search}>
            <input
              className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm"
              disabled={pending}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ticket-ID, Betreff oder Kontakt"
              value={query}
            />
            <Button disabled={pending || query.trim().length < 2} type="submit" variant="outline">
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Ticket suchen
            </Button>
          </form>
          {results.length ? (
            <div className="mt-4 space-y-2">
              {results.map((ticket) => {
                const alreadyLinked = links.some((link) => link.externalId === ticket.id);
                return (
                  <article
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                    key={ticket.id}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground">
                        Ticket {ticket.ticketNumber ?? ticket.id} · {ticket.status}
                        {ticket.contact?.name ? ` · ${ticket.contact.name}` : ""}
                      </p>
                    </div>
                    <Button
                      className="h-9"
                      disabled={pending || alreadyLinked}
                      onClick={() => void connect(ticket.id)}
                    >
                      <Link2 className="size-4" /> {alreadyLinked ? "Verknüpft" : "Verknüpfen"}
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
