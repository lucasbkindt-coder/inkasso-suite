#!/usr/bin/env bash

set -euo pipefail

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$script_root/scripts/lib/local-db-guard.sh"

arguments=("$@")
if [[ "${arguments[0]:-}" == "--" ]]; then
  arguments=("${arguments[@]:1}")
fi
backup_file="${arguments[0]:-}"
confirmation="${arguments[1]:-}"
if [[ -z "$backup_file" ]]; then
  echo "Verwendung: pnpm db:restore -- <backup-file> [--confirm]" >&2
  exit 1
fi
if [[ ! -f "$backup_file" ]]; then
  echo "Abbruch: Backup-Datei nicht gefunden: $backup_file" >&2
  exit 1
fi

load_local_environment
assert_local_development_database

if ! compose_postgres pg_restore --list < "$backup_file" > /dev/null; then
  echo "Abbruch: Die Backup-Datei ist kein lesbares PostgreSQL-Custom-Backup." >&2
  exit 1
fi

if [[ "$confirmation" != "--confirm" ]]; then
  echo "Dry Run: Restore nicht ausgeführt. Dieser Vorgang überschreibt die lokale Arbeitsdatenbank."
  echo "Für eine ausdrücklich bestätigte Wiederherstellung: pnpm db:restore -- $backup_file --confirm"
  exit 0
fi

echo "Stelle lokales Backup wieder her: $backup_file"
compose_postgres pg_restore --clean --if-exists --no-owner --no-privileges -U "$POSTGRES_USER" -d "$POSTGRES_DB" < "$backup_file"
echo "Restore abgeschlossen. Bitte anschließend /health und einen Login-Smoke prüfen."
