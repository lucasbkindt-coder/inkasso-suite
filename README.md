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

Die NestJS-Laufzeit ist danach unter `http://localhost:3001` erreichbar. Es gibt
bewusst noch keine API-Endpunkte. Das Frontend wird erst mit der späteren
Frontend-Implementierung gestartet.

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

## Workspaces

- `apps/web` – reserviertes Next.js-15-Frontend
- `apps/api` – NestJS-Laufzeit ohne API-Endpunkte
- `packages/database` – Prisma und PostgreSQL-Konfiguration
- `packages/shared` – gemeinsam genutzte TypeScript-Bausteine
- `packages/ui` – reservierte UI-Bausteine
- `packages/config` – zentrale Tool-Konfiguration
- `packages/types` – reservierte gemeinsame Typen
- `docs` – Projektdokumentation
