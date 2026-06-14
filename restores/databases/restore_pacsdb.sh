#!/bin/bash

# Usage:
#   bash restore_pacsdb.sh                  # restore latest backup
#   bash restore_pacsdb.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_pacsdb_$(date +%Y%m%d_%H%M%S).log"

TOTAL_STEPS=5
CURRENT_STEP=0

progress() {
  local pct=$((CURRENT_STEP * 100 / TOTAL_STEPS))
  local filled=$((pct / 5))
  local empty=$((20 - filled))
  local bar=""
  for ((i=0; i<filled; i++)); do bar="${bar}█"; done
  for ((i=0; i<empty; i++)); do bar="${bar}░"; done
  printf "\r  [%s] %3d%% — %s" "$bar" "$pct" "$1"
}

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

CURRENT_STEP=1
progress "Starting pacsdb..."
docker start bahmni-standard-pacsdb-1 >/dev/null 2>&1

until docker exec bahmni-standard-pacsdb-1 pg_isready -U postgres &>/dev/null; do
  sleep 3
done

CURRENT_STEP=2
progress "Terminating connections..."
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='pacs_db';" >/dev/null 2>&1 || true

CURRENT_STEP=3
progress "Dropping and recreating database..."
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS pacs_db;" >/dev/null 2>&1 || true
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres \
  -c "CREATE DATABASE pacs_db OWNER pacs_user;" 2>/dev/null

CURRENT_STEP=4
progress "Restoring from backup..."
docker cp "$FILE" bahmni-standard-pacsdb-1:/tmp/restore.sql.gz 2>/dev/null
docker exec bahmni-standard-pacsdb-1 sh -c "zcat /tmp/restore.sql.gz | psql -U postgres -d pacs_db" 2>/dev/null

CURRENT_STEP=5
progress "Done!"

printf "\r  [████████████████████] 100%% — Done!\n" | tee -a "$LOG"
echo "PACS restore complete." | tee -a "$LOG"
