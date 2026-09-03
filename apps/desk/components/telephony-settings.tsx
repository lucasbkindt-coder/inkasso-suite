"use client";

import { KeyRound, Loader2, Phone, Plus, ShieldCheck, Trash2 } from "lucide-react";
import * as React from "react";

import { deskApi, type DeskOptions } from "@/lib/desk-api";
import {
  telephonyApi,
  type StaffTelephonyAccount,
  type TelephonyProviderConfig,
} from "@/lib/telephony-api";
import { DeskSessionContext } from "./desk-auth-gate";
import { fieldClass } from "./ticket-ui";

export function TelephonySettings() {
  const session = React.useContext(DeskSessionContext);
  const canManage = session?.permissions.includes("desk:telephony:manage") ?? false;
  const canManageOwn = session?.permissions.includes("desk:telephony:manage-own") ?? false;
  const [configs, setConfigs] = React.useState<TelephonyProviderConfig[]>([]);
  const [accounts, setAccounts] = React.useState<StaffTelephonyAccount[]>([]);
  const [options, setOptions] = React.useState<DeskOptions>({ memberships: [], teams: [] });
  const [selected, setSelected] = React.useState<StaffTelephonyAccount | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [accountForm, setAccountForm] = React.useState({
    membershipId: session?.membership.id ?? "",
    telephonyProviderConfigId: "",
    name: "Hauptleitung",
    extension: "",
    displayNumber: "",
    outboundCallerId: "",
    registrarOverride: "",
    proxyOverride: "",
    domainOverride: "",
    portOverride: "",
    transportOverride: "",
    webSocketUrlOverride: "",
  });
  const [credentialForm, setCredentialForm] = React.useState({
    sipUsername: "",
    sipAuthId: "",
    sipPassword: "",
    turnUsername: "",
    turnPassword: "",
  });
  const [providerForm, setProviderForm] = React.useState({
    name: "Lokale MOCK-Telefonie",
    providerType: "MOCK",
    defaultRegistrar: "",
    defaultProxy: "",
    defaultDomain: "",
    defaultPort: "",
    defaultTransport: "WSS",
    defaultWebSocketUrl: "",
    defaultStun: "",
    defaultTurn: "",
  });
  const load = React.useCallback(() => {
    setError("");
    return Promise.all([
      telephonyApi.providerConfigs(),
      telephonyApi.accounts(),
      canManage ? deskApi.options() : Promise.resolve({ memberships: [], teams: [] }),
    ])
      .then(([providerConfigs, staffAccounts, selectable]) => {
        setConfigs(providerConfigs);
        setAccounts(staffAccounts);
        setOptions(selectable);
        setAccountForm((current) => ({
          ...current,
          membershipId: current.membershipId || session?.membership.id || "",
          telephonyProviderConfigId:
            current.telephonyProviderConfigId || providerConfigs[0]?.id || "",
        }));
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Telefonieeinstellungen konnten nicht geladen werden.",
        ),
      );
  }, [canManage, session?.membership.id]);
  React.useEffect(() => {
    void load();
  }, [load]);
  async function execute(action: () => Promise<unknown>, message: string) {
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await action();
      await load();
      setSuccess(message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Änderung konnte nicht gespeichert werden.",
      );
    } finally {
      setPending(false);
    }
  }
  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    await execute(
      () =>
        telephonyApi.createAccount({
          membershipId: accountForm.membershipId,
          telephonyProviderConfigId: accountForm.telephonyProviderConfigId,
          name: accountForm.name,
          extension: accountForm.extension || undefined,
          displayNumber: accountForm.displayNumber || undefined,
          outboundCallerId: accountForm.outboundCallerId || undefined,
          registrarOverride: accountForm.registrarOverride || undefined,
          proxyOverride: accountForm.proxyOverride || undefined,
          domainOverride: accountForm.domainOverride || undefined,
          portOverride: accountForm.portOverride ? Number(accountForm.portOverride) : undefined,
          transportOverride: accountForm.transportOverride || undefined,
          webSocketUrlOverride: accountForm.webSocketUrlOverride || undefined,
          isDefault: true,
        }),
      "Telefoniekonto wurde angelegt.",
    );
  }
  async function setCredentials(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await execute(
      () =>
        telephonyApi.setCredentials(selected.id, {
          ...credentialForm,
          sipAuthId: credentialForm.sipAuthId || undefined,
          turnUsername: credentialForm.turnUsername || undefined,
          turnPassword: credentialForm.turnPassword || undefined,
        }),
      "Zugangsdaten wurden verschlüsselt gespeichert.",
    );
    setCredentialForm({
      sipUsername: "",
      sipAuthId: "",
      sipPassword: "",
      turnUsername: "",
      turnPassword: "",
    });
    setSelected(null);
  }
  async function createProvider(event: React.FormEvent) {
    event.preventDefault();
    await execute(
      () =>
        telephonyApi.createProviderConfig({
          name: providerForm.name,
          providerType: providerForm.providerType,
          status: "ACTIVE",
          defaultRegistrar: providerForm.defaultRegistrar || undefined,
          defaultProxy: providerForm.defaultProxy || undefined,
          defaultDomain: providerForm.defaultDomain || undefined,
          defaultPort: providerForm.defaultPort ? Number(providerForm.defaultPort) : undefined,
          defaultTransport: providerForm.defaultTransport || undefined,
          defaultWebSocketUrl: providerForm.defaultWebSocketUrl || undefined,
          defaultStun: providerForm.defaultStun || undefined,
          defaultTurn: providerForm.defaultTurn || undefined,
        }),
      "Anbieterkonfiguration wurde angelegt.",
    );
  }
  return (
    <section className="space-y-6 pb-24">
      <header>
        <p className="text-sm font-medium text-primary">Desk Einstellungen</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Telefonie</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tenant-Defaults und persönliche SIP-Konten. Zugangsdaten werden niemals angezeigt.
        </p>
      </header>
      {error ? (
        <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      ) : null}
      {canManage ? (
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">Anbieter / Tenant-Konfiguration</h2>
              <p className="text-xs text-muted-foreground">
                Gemeinsame, nicht geheime Verbindungsdefaults
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {configs.map((config) => (
              <div className="rounded-xl border p-4" key={config.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{config.name}</p>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {config.providerType} · {config.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Registrar {config.defaultRegistrar ?? "–"} · WSS{" "}
                  {config.defaultWebSocketUrl ?? "–"}
                </p>
              </div>
            ))}
          </div>
          <form
            className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2 lg:grid-cols-3"
            onSubmit={createProvider}
          >
            <label className="grid gap-1 text-sm">
              Name
              <input
                className={fieldClass}
                onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                required
                value={providerForm.name}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Provider-Modus
              <select
                className={fieldClass}
                onChange={(e) => setProviderForm({ ...providerForm, providerType: e.target.value })}
                value={providerForm.providerType}
              >
                <option value="MOCK">MOCK</option>
                <option value="DIRECT_WEBRTC">DIRECT_WEBRTC</option>
                <option value="GATEWAY_REQUIRED">GATEWAY_REQUIRED</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Registrar
              <input
                className={fieldClass}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, defaultRegistrar: e.target.value })
                }
                value={providerForm.defaultRegistrar}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Proxy
              <input
                className={fieldClass}
                onChange={(e) => setProviderForm({ ...providerForm, defaultProxy: e.target.value })}
                value={providerForm.defaultProxy}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Domain
              <input
                className={fieldClass}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, defaultDomain: e.target.value })
                }
                value={providerForm.defaultDomain}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Port
              <input
                className={fieldClass}
                max="65535"
                min="1"
                onChange={(e) => setProviderForm({ ...providerForm, defaultPort: e.target.value })}
                type="number"
                value={providerForm.defaultPort}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Transport
              <select
                className={fieldClass}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, defaultTransport: e.target.value })
                }
                value={providerForm.defaultTransport}
              >
                <option>WSS</option>
                <option>TLS</option>
                <option>TCP</option>
                <option>UDP</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              WebSocket URL
              <input
                className={fieldClass}
                onChange={(e) =>
                  setProviderForm({ ...providerForm, defaultWebSocketUrl: e.target.value })
                }
                value={providerForm.defaultWebSocketUrl}
              />
            </label>
            <label className="grid gap-1 text-sm">
              STUN
              <input
                className={fieldClass}
                onChange={(e) => setProviderForm({ ...providerForm, defaultStun: e.target.value })}
                value={providerForm.defaultStun}
              />
            </label>
            <label className="grid gap-1 text-sm">
              TURN
              <input
                className={fieldClass}
                onChange={(e) => setProviderForm({ ...providerForm, defaultTurn: e.target.value })}
                value={providerForm.defaultTurn}
              />
            </label>
            <button
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 lg:self-end"
              disabled={pending}
              type="submit"
            >
              <Plus className="mr-2 inline size-4" />
              Anbieter anlegen
            </button>
          </form>
        </article>
      ) : null}
      <article className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Phone className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">
              {canManage ? "Mitarbeiter-Telefonie" : "Meine Telefonie"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Mehrere Konten je Mitarbeiter werden unterstützt.
            </p>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {[
                  "Mitarbeiter",
                  "Konto",
                  "Nebenstelle",
                  "Anzeigenummer",
                  "Account",
                  "Credentials",
                  "Registrierung",
                  "Default",
                  "Aktionen",
                ].map((item) => (
                  <th className="border-b px-3 py-2 font-medium" key={item}>
                    {item}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr className="border-b last:border-0" key={account.id}>
                  <td className="px-3 py-3">
                    {account.membership.user.displayName ?? account.membership.user.email}
                  </td>
                  <td className="px-3 py-3 font-medium">{account.name}</td>
                  <td className="px-3 py-3">{account.extension ?? "–"}</td>
                  <td className="px-3 py-3">{account.displayNumber ?? "–"}</td>
                  <td className="px-3 py-3">{account.enabled ? "Aktiv" : "Deaktiviert"}</td>
                  <td className="px-3 py-3">{account.credentialsConfigured ? "Ja" : "Nein"}</td>
                  <td className="px-3 py-3">{account.registrationStatus}</td>
                  <td className="px-3 py-3">{account.isDefault ? "Ja" : "Nein"}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button
                        aria-label="Credentials setzen"
                        className="grid size-8 place-items-center rounded-lg border"
                        onClick={() => setSelected(account)}
                        type="button"
                      >
                        <KeyRound className="size-4" />
                      </button>
                      <button
                        className="rounded-lg border px-2 text-xs"
                        disabled={pending || !account.credentialsConfigured}
                        onClick={() =>
                          void execute(
                            () => telephonyApi.testAccount(account.id),
                            "Verbindungstest abgeschlossen.",
                          )
                        }
                        type="button"
                      >
                        Test
                      </button>
                      <button
                        className="rounded-lg border px-2 text-xs"
                        disabled={pending || account.isDefault}
                        onClick={() =>
                          void execute(
                            () => telephonyApi.updateAccount(account.id, { isDefault: true }),
                            "Default-Konto wurde geändert.",
                          )
                        }
                        type="button"
                      >
                        Default
                      </button>
                      {canManage ? (
                        <button
                          className="rounded-lg border px-2 text-xs"
                          disabled={pending}
                          onClick={() =>
                            void execute(
                              () =>
                                telephonyApi.updateAccount(account.id, {
                                  enabled: !account.enabled,
                                }),
                              account.enabled
                                ? "Konto wurde deaktiviert."
                                : "Konto wurde aktiviert.",
                            )
                          }
                          type="button"
                        >
                          {account.enabled ? "Deaktivieren" : "Aktivieren"}
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          aria-label="Telefoniekonto entfernen"
                          className="grid size-8 place-items-center rounded-lg border text-red-600"
                          disabled={pending}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Telefoniekonto wirklich entfernen? Historische Anrufe bleiben erhalten.",
                              )
                            ) {
                              void execute(
                                () => telephonyApi.removeAccount(account.id),
                                "Konto wurde entfernt.",
                              );
                            }
                          }}
                          type="button"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!accounts.length ? (
          <p className="mt-4 text-sm text-muted-foreground">Telefonie nicht eingerichtet.</p>
        ) : null}
      </article>
      {(canManage || canManageOwn) && configs.length ? (
        <form className="rounded-2xl border bg-card p-5 shadow-sm" onSubmit={createAccount}>
          <h2 className="font-semibold">Telefoniekonto anlegen</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {canManage ? (
              <label className="grid gap-1 text-sm">
                Mitarbeiter
                <select
                  className={fieldClass}
                  onChange={(e) => setAccountForm({ ...accountForm, membershipId: e.target.value })}
                  required
                  value={accountForm.membershipId}
                >
                  {options.memberships.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="grid gap-1 text-sm">
              Anbieter
              <select
                className={fieldClass}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, telephonyProviderConfigId: e.target.value })
                }
                value={accountForm.telephonyProviderConfigId}
              >
                {configs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              Kontoname
              <input
                className={fieldClass}
                maxLength={150}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                required
                value={accountForm.name}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Nebenstelle
              <input
                className={fieldClass}
                onChange={(e) => setAccountForm({ ...accountForm, extension: e.target.value })}
                value={accountForm.extension}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Anzeigenummer
              <input
                className={fieldClass}
                onChange={(e) => setAccountForm({ ...accountForm, displayNumber: e.target.value })}
                value={accountForm.displayNumber}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Outbound Caller ID
              <input
                className={fieldClass}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, outboundCallerId: e.target.value })
                }
                value={accountForm.outboundCallerId}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Registrar Override
              <input
                className={fieldClass}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, registrarOverride: e.target.value })
                }
                value={accountForm.registrarOverride}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Proxy Override
              <input
                className={fieldClass}
                onChange={(e) => setAccountForm({ ...accountForm, proxyOverride: e.target.value })}
                value={accountForm.proxyOverride}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Domain Override
              <input
                className={fieldClass}
                onChange={(e) => setAccountForm({ ...accountForm, domainOverride: e.target.value })}
                value={accountForm.domainOverride}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Port Override
              <input
                className={fieldClass}
                max="65535"
                min="1"
                onChange={(e) => setAccountForm({ ...accountForm, portOverride: e.target.value })}
                type="number"
                value={accountForm.portOverride}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Transport Override
              <select
                className={fieldClass}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, transportOverride: e.target.value })
                }
                value={accountForm.transportOverride}
              >
                <option value="">Tenant-Default</option>
                <option>WSS</option>
                <option>TLS</option>
                <option>TCP</option>
                <option>UDP</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              WebSocket Override
              <input
                className={fieldClass}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, webSocketUrlOverride: e.target.value })
                }
                value={accountForm.webSocketUrlOverride}
              />
            </label>
          </div>
          <button
            className="mt-4 h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={
              pending || !accountForm.membershipId || !accountForm.telephonyProviderConfigId
            }
            type="submit"
          >
            {pending ? (
              <Loader2 className="mr-2 inline size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 inline size-4" />
            )}
            Konto anlegen
          </button>
        </form>
      ) : null}
      {selected ? (
        <form
          className="rounded-2xl border border-primary/30 bg-card p-5 shadow-sm"
          onSubmit={setCredentials}
        >
          <h2 className="font-semibold">Credentials für {selected.name} setzen/ersetzen</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Vorhandene Werte werden nicht ausgelesen. Speichern ersetzt den verschlüsselten
            Datensatz vollständig.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm">
              SIP-Benutzername
              <input
                autoComplete="off"
                className={fieldClass}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, sipUsername: e.target.value })
                }
                required
                value={credentialForm.sipUsername}
              />
            </label>
            <label className="grid gap-1 text-sm">
              SIP Auth-ID
              <input
                autoComplete="off"
                className={fieldClass}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, sipAuthId: e.target.value })
                }
                value={credentialForm.sipAuthId}
              />
            </label>
            <label className="grid gap-1 text-sm">
              SIP-Passwort
              <input
                autoComplete="new-password"
                className={fieldClass}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, sipPassword: e.target.value })
                }
                required
                type="password"
                value={credentialForm.sipPassword}
              />
            </label>
            <label className="grid gap-1 text-sm">
              TURN-Benutzer optional
              <input
                autoComplete="off"
                className={fieldClass}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, turnUsername: e.target.value })
                }
                value={credentialForm.turnUsername}
              />
            </label>
            <label className="grid gap-1 text-sm">
              TURN-Passwort optional
              <input
                autoComplete="new-password"
                className={fieldClass}
                onChange={(e) =>
                  setCredentialForm({ ...credentialForm, turnPassword: e.target.value })
                }
                type="password"
                value={credentialForm.turnPassword}
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={pending}
              type="submit"
            >
              Verschlüsselt speichern
            </button>
            <button
              className="h-10 rounded-lg border px-4 text-sm"
              onClick={() => setSelected(null)}
              type="button"
            >
              Abbrechen
            </button>
            {selected.credentialsConfigured ? (
              <button
                className="h-10 rounded-lg border px-4 text-sm text-red-600"
                onClick={() =>
                  void execute(
                    () => telephonyApi.deleteCredentials(selected.id),
                    "Credentials wurden gelöscht.",
                  )
                }
                type="button"
              >
                Credentials löschen
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
