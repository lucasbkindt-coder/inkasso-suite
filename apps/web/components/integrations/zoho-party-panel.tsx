"use client";

import { Link2, Loader2, Search, Unlink } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";
import { zohoDeskApi, type ZohoDeskContact, type ZohoDeskContactLink } from "./zoho-desk-api";

export function ZohoPartyPanel({ partyId }: { partyId: string }) {
  const [link, setLink] = React.useState<ZohoDeskContactLink | null>(null);
  const [results, setResults] = React.useState<ZohoDeskContact[]>([]);
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
        if (readable) setLink(await zohoDeskApi.partyLink(partyId));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [partyId]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError("Bitte geben Sie mindestens zwei Zeichen ein.");
      return;
    }
    setPending(true);
    setError("");
    try {
      setResults(await zohoDeskApi.searchContacts(query.trim()));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Zoho-Kontakte konnten nicht gesucht werden.",
      );
    } finally {
      setPending(false);
    }
  }

  async function connect(externalId: string) {
    setPending(true);
    setError("");
    try {
      setLink(await zohoDeskApi.linkParty(partyId, externalId));
      setResults([]);
      setQuery("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Der Zoho-Kontakt konnte nicht verknüpft werden.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disconnect() {
    if (!link || !window.confirm("Zoho-Kontaktverknüpfung wirklich entfernen?")) return;
    setPending(true);
    setError("");
    try {
      await zohoDeskApi.unlinkParty(partyId, link.id);
      setLink(null);
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Integration</p>
          <h3 className="mt-1 font-semibold">Zoho Desk</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Manuelle Zuordnung zur externen Kontaktidentität.
          </p>
        </div>
        {link && canManage ? (
          <Button disabled={pending} onClick={() => void disconnect()} variant="outline">
            <Unlink className="size-4" /> Verknüpfung entfernen
          </Button>
        ) : null}
      </div>
      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {link ? (
        <div className="mt-5 rounded-lg border bg-muted/20 p-4">
          <p className="font-medium">{link.metadata?.displayName ?? "Verknüpfter Zoho-Kontakt"}</p>
          <p className="mt-1 text-sm text-muted-foreground">Externe ID: {link.externalId}</p>
          {link.metadata?.email ? <p className="mt-1 text-sm">{link.metadata.email}</p> : null}
          {link.metadata?.phone || link.metadata?.mobile ? (
            <p className="mt-1 text-sm">{link.metadata.phone ?? link.metadata.mobile}</p>
          ) : null}
        </div>
      ) : canManage ? (
        <>
          <form className="mt-5 flex flex-col gap-2 sm:flex-row" onSubmit={search}>
            <input
              className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm"
              disabled={pending}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="E-Mail, Telefonnummer oder Name"
              value={query}
            />
            <Button disabled={pending || query.trim().length < 2} type="submit" variant="outline">
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}{" "}
              Kontakt suchen
            </Button>
          </form>
          {results.length ? (
            <div className="mt-4 space-y-2">
              {results.map((contact) => (
                <article
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  key={contact.id}
                >
                  <div>
                    <p className="text-sm font-medium">{contact.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {contact.email ?? contact.phone ?? contact.mobile ?? "Keine Kontaktdaten"} ·
                      ID {contact.id}
                    </p>
                  </div>
                  <Button className="h-9" disabled={pending} onClick={() => void connect(contact.id)}>
                    <Link2 className="size-4" /> Verknüpfen
                  </Button>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Keine Zoho-Kontaktverknüpfung vorhanden.
        </p>
      )}
    </section>
  );
}
