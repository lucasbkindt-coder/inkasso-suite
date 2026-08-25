#!/usr/bin/env bash

set -euo pipefail

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$script_root/scripts/lib/local-db-guard.sh"

load_local_environment
assert_local_development_database

backup_dir="$script_root/.data/backups"
timestamp="$(date -u +%Y-%m-%dT%H%M%SZ)"
backup_file="$backup_dir/payveo-local-$timestamp.dump"
mkdir -p "$backup_dir"

echo "Erstelle lokales PostgreSQL-Backup: $backup_file"
compose_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$backup_file"

if [[ ! -s "$backup_file" ]]; then
  echo "Fehler: Das Backup ist leer." >&2
  exit 1
fi

if ! compose_postgres pg_restore --list < "$backup_file" > /dev/null; then
  echo "Fehler: Das Backup konnte nicht mit pg_restore --list validiert werden." >&2
  exit 1
fi

echo "Backup erfolgreich validiert: $backup_file ($(wc -c < "$backup_file" | tr -d ' ') Bytes)"
