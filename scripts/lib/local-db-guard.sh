#!/usr/bin/env bash

set -euo pipefail

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

load_local_environment() {
  if [[ -f "$workspace_root/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$workspace_root/.env"
    set +a
  fi
  : "${DATABASE_URL:?DATABASE_URL muss in .env oder der Umgebung gesetzt sein.}"
}

assert_local_development_database() {
  if [[ "${NODE_ENV:-development}" == "production" ]]; then
    echo "Abbruch: Backup/Restore ist mit NODE_ENV=production nicht zulässig." >&2
    exit 1
  fi

  node - "$DATABASE_URL" <<'NODE'
const value = process.argv[2];
let url;
try {
  url = new URL(value);
} catch {
  console.error("Abbruch: DATABASE_URL ist ungültig.");
  process.exit(1);
}
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);
const database = url.pathname.replace(/^\//, "").split("/")[0];
if (!localHosts.has(url.hostname) || !database || /prod(uction)?/i.test(url.hostname) || /prod(uction)?/i.test(database)) {
  console.error("Abbruch: DATABASE_URL ist kein eindeutig lokales Entwicklungsziel.");
  process.exit(1);
}
NODE

  if ! docker compose -f "$workspace_root/compose.yaml" ps --status running postgres | grep -q postgres; then
    echo "Abbruch: der lokale Compose-Service postgres läuft nicht." >&2
    exit 1
  fi
}

compose_postgres() {
  docker compose -f "$workspace_root/compose.yaml" exec -T postgres "$@"
}
