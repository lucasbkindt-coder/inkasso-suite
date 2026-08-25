#!/usr/bin/env bash

set -euo pipefail

backup_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.data/backups"
if [[ ! -d "$backup_dir" ]]; then
  echo "Keine lokalen Backups vorhanden."
  exit 0
fi

find "$backup_dir" -maxdepth 1 -type f -name 'payveo-local-*.dump' -print | sort
