# Lokaler Entwicklungsarbeitsbereich

Der lokale Tenant kann Arbeitsdaten enthalten. Behandle ihn wie schützenswerte
interne Daten: keine Datenbank-Resets, keine pauschalen Löschungen und kein
Leeren von `.data/documents`.

## Start

```bash
docker compose up -d
pnpm dev
curl http://localhost:3001/health
```

Web und API binden im Entwicklungsbetrieb an `0.0.0.0:3000` beziehungsweise
`0.0.0.0:3001`. Das Web verwendet relative `/api`-Aufrufe; der serverseitige
Rewrite-Zielhost ist über `RISEPAY_API_INTERNAL_URL` konfigurierbar.

## Backup und Restore

Vor Migrationen oder Datenbereinigungen ein Backup erstellen:

```bash
pnpm db:backup
pnpm db:backup:list
```

Backups liegen nur lokal unter `.data/backups` und werden nicht versioniert.
Sie verwenden PostgreSQL Custom Format und werden beim Erstellen mit
`pg_restore --list` geprüft.

Ein Restore betrifft die lokale Arbeitsdatenbank und ist destruktiv. Ohne
Bestätigung läuft nur ein Dry Run:

```bash
pnpm db:restore -- .data/backups/payveo-local-<timestamp>.dump
pnpm db:restore -- .data/backups/payveo-local-<timestamp>.dump --confirm
```

Backup, Restore und Testdaten-Cleanup brechen bei `NODE_ENV=production` oder
einem nicht eindeutig lokalen Datenbankziel ab.

## Migration, Seed und Cleanup

Für Arbeitsdaten niemals `prisma migrate reset` verwenden. Nur additive
Migrationen über `pnpm db:migrate` ausführen und danach `/health` sowie einen
kurzen Login-/Akten-Smoke prüfen.

`pnpm db:seed` ergänzt ausschließlich technische Basisdaten, Berechtigungen,
Systemrollen und die 13 aktiven Systemvorlagen. Es erzeugt oder überschreibt
keine Parteien, Akten, Zahlungen, Aufgaben oder Dokumente.

Der Testdaten-Cleanup ist standardmäßig ein Dry Run:

```bash
pnpm db:test-data:cleanup
node scripts/cleanup-local-test-data.js --execute
```

Er kann ausschließlich explizit gelistete, inaktive Test-/Audit-Tenants
entfernen. Aktive Tenants und Benutzer mit Membership in verbleibenden aktiven
Tenants sind gesperrt.

## Dokumentstorage

Lokale PDFs liegen in `.data/documents` und werden über den `storageKey` eines
`CaseDocument` referenziert. Es gibt keinen Startup-Cleanup. Die read-only
Prüfung meldet fehlende und verwaiste Dateien, löscht aber niemals etwas:

```bash
pnpm storage:audit
```

`MAIL_TRANSPORT=log` ist die sichere lokale Voreinstellung. Für Portal-Links
bleibt `PORTAL_PUBLIC_BASE_URL` konfigurierbar; keine Produktionsdomain ist
fest im Code hinterlegt.
