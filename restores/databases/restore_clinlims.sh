#!/bin/bash

# Usage:
#   bash restore_clinlims.sh                  # restore latest backup
#   bash restore_clinlims.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_clinlims_$(date +%Y%m%d_%H%M%S).log"

echo "=== OpenELIS (clinlims) Restore Started: $(date) ===" | tee "$LOG"

if [ -z "$DATE_ARG" ]; then
  echo "No date given — using latest backup." | tee -a "$LOG"
  FILE=$(ls -t "$BACKUP_DIR"/clinlims_*.pgsql.gz 2>/dev/null | head -1)
else
  FILE="$BACKUP_DIR/clinlims_${DATE_ARG}.pgsql.gz"
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE" | tee -a "$LOG"; exit 1
fi

echo "File: $FILE" | tee -a "$LOG"

echo "Starting openelisdb..." | tee -a "$LOG"
docker start bahmni-standard-openelisdb-1

echo "Waiting for PostgreSQL..." | tee -a "$LOG"
until docker exec bahmni-standard-openelisdb-1 pg_isready -U clinlims &>/dev/null; do
  echo "  not ready..."; sleep 3
done
echo "PostgreSQL ready." | tee -a "$LOG"

echo "Dropping and recreating database..." | tee -a "$LOG"
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres \
  -c "DROP DATABASE IF EXISTS clinlims; CREATE DATABASE clinlims OWNER clinlims;"

echo "Restoring..." | tee -a "$LOG"
zcat "$FILE" | docker exec -i bahmni-standard-openelisdb-1 psql -U clinlims -d clinlims

echo "OpenELIS restore complete. Exit: $?" | tee -a "$LOG"
