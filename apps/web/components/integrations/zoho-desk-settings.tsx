"use client";

import { CheckCircle2, CircleAlert, Loader2, PlugZap } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { staffAuthApi } from "@/lib/staff-auth-api";
import { zohoDeskApi, type ZohoDeskStatus } from "./zoho-desk-api";

export function ZohoDeskSettings() {
  const [status, setStatus] = React.useState<ZohoDeskStatus | null>(null);
  const [canRead, setCanRead] = React.useState(false);
  const [canManage, setCanManage] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [testing, setTesting] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void staffAuthApi
      .session()
      .then(async (session) => {
        const readable = session.permissions.includes("integration:read");
        setCanRead(readable);
        setCanManage(session.permissions.includes("integration:manage"));
        if (readable) setStatus(await zohoDeskApi.status());
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Der Integrationsstatus konnte nicht geladen werden.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  async function testConnection() {
    setTesting(true);
    setError("");
    try {
      setStatus(await zohoDeskApi.test());
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Die Zoho-Verbindung konnte nicht geprüft werden.",
      );
    } finally {
      setTesting(false);
    }
  }

  if (loading)
    return (
      <section className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Zoho-Desk-Integration wird geladen …
      </section>
    );
  if (!canRead) return null;
  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Integration</p>
          <h2 className="mt-1 text-xl font-semibold">Zoho Desk</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Technische Verbindung für die spätere Ticket-, E-Mail- und CTI-Anbindung. Zugangsdaten
            werden ausschließlich serverseitig verarbeitet.
          </p>
        </div>
        {canManage ? (
          <Button
            disabled={testing || !status?.configured}
            onClick={() => void testConnection()}
            variant="outline"
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : <PlugZap className="size-4" />}{" "}
            Verbindung testen
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatusCard
            label="Konfiguration"
            state={status.configured}
            text={
              status.configured
                ? `Vollständig · Region ${status.region}`
                : "Nicht vollständig konfiguriert"
            }
          />
          <StatusCard
            label="Verbindung"
            state={status.connected}
            text={
              status.connected === null
                ? "Noch nicht geprüft"
                : status.connected
                  ? "Erreichbar"
                  : "Nicht erreichbar"
            }
          />
          <StatusCard
            label="Organisation"
            state={status.organizationReachable}
            text={
              status.organizationReachable === null
                ? "Noch nicht geprüft"
                : status.organizationReachable
                  ? "Erreichbar"
                  : "Nicht bestätigt"
            }
          />
        </div>
      ) : null}
      {status?.lastError ? (
        <p className="mt-4 text-sm text-destructive">{status.lastError}</p>
      ) : null}
      {!status?.configured ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Die OAuth-Zugangsdaten und Organisations-ID müssen in der serverseitigen Umgebung
          hinterlegt werden. Geheimnisse werden hier nicht angezeigt.
        </p>
      ) : null}
      {status?.lastCheckedAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Zuletzt geprüft:{" "}
          {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(
            new Date(status.lastCheckedAt),
          )}
        </p>
      ) : null}
    </section>
  );
}

function StatusCard({
  label,
  state,
  text,
}: {
  label: string;
  state: boolean | null;
  text: string;
}) {
  const Icon = state === false ? CircleAlert : CheckCircle2;
  return (
    <article className="rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <Icon
          className={
            state === false
              ? "size-4 text-amber-600"
              : state === true
                ? "size-4 text-emerald-600"
                : "size-4 text-muted-foreground"
          }
        />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </article>
  );
}
