# Inkasso Suite

Monorepo-Grundstruktur für die browserbasierte Inkasso-Plattform.

## Voraussetzungen

- Node.js 22 oder neuer
- pnpm 10
- Docker Desktop oder eine kompatible Docker-Compose-Installation

## Lokaler Start

```bash
cp .env.example .env
pnpm install
docker compose up -d
pnpm dev
```

Die Web-Anwendung ist danach unter `http://localhost:3000`, die NestJS-API
unter `http://localhost:3001` erreichbar. Der API-Healthcheck ist
`http://localhost:3001/health`.

## Datenbankwerkzeuge

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

`DATABASE_URL` wird zentral aus der Root-Datei `.env` geladen. Die PostgreSQL-
Daten liegen im Docker-Volume `postgres-data`.

## Infrastruktur beenden

```bash
pnpm infra:down
```

## Lokaler Arbeitsdaten-Schutz

Der lokale Entwicklungs-Tenant kann Arbeitsdaten enthalten. Vor Migrationen
oder gezielten Testdaten-Cleanups ein Backup erstellen und niemals
`prisma migrate reset` gegen diese Datenbank ausführen. Die Betriebsanleitung
für Backup, Restore, Storage-Audit und sichere Testdatenbereinigung steht in
[docs/development-workspace.md](docs/development-workspace.md).

## Workspaces

- `apps/web` – reserviertes Next.js-15-Frontend
- `apps/api` – NestJS-Laufzeit ohne API-Endpunkte
- `packages/database` – Prisma und PostgreSQL-Konfiguration
- `packages/shared` – gemeinsam genutzte TypeScript-Bausteine
- `packages/ui` – reservierte UI-Bausteine
- `packages/config` – zentrale Tool-Konfiguration
- `packages/types` – reservierte gemeinsame Typen
- `docs` – Projektdokumentation
