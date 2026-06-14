#!/bin/bash

# Usage:
#   bash restore_pacsdb.sh                  # restore latest backup
#   bash restore_pacsdb.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_pacsdb_$(date +%Y%m%d_%H%M%S).log"

echo "=== PACS DB Restore Started: $(date) ===" | tee "$LOG"

if [ -z "$DATE_ARG" ]; then
  echo "No date given — using latest backup." | tee -a "$LOG"
  FILE=$(ls -t "$BACKUP_DIR"/pacsdb_*.pgsql.gz 2>/dev/null | head -1)
else
  FILE="$BACKUP_DIR/pacsdb_${DATE_ARG}.pgsql.gz"
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE" | tee -a "$LOG"; exit 1
fi

echo "File: $FILE" | tee -a "$LOG"

echo "Starting pacsdb..." | tee -a "$LOG"
docker start bahmni-standard-pacsdb-1

echo "Waiting for PostgreSQL..." | tee -a "$LOG"
until docker exec bahmni-standard-pacsdb-1 pg_isready -U postgres &>/dev/null; do
  echo "  not ready..."; sleep 3
done
echo "PostgreSQL ready." | tee -a "$LOG"

echo "Dropping and recreating database..." | tee -a "$LOG"
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS pacs_db; CREATE DATABASE pacs_db OWNER pacs_user;"

echo "Restoring..." | tee -a "$LOG"
zcat "$FILE" | docker exec -i bahmni-standard-pacsdb-1 psql -U postgres -d pacs_db

echo "PACS restore complete. Exit: $?" | tee -a "$LOG"
