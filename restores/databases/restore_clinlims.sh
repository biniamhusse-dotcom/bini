#!/bin/bash

# Usage:
#   bash restore_clinlims.sh                  # restore latest backup
#   bash restore_clinlims.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_clinlims_$(date +%Y%m%d_%H%M%S).log"

TOTAL_STEPS=6
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

CURRENT_STEP=1
progress "Starting openelisdb..."
docker start bahmni-standard-openelisdb-1 >/dev/null 2>&1

until docker exec bahmni-standard-openelisdb-1 pg_isready -U clinlims &>/dev/null; do
  sleep 3
done

CURRENT_STEP=2
progress "Stopping OpenELIS app..."
docker stop bahmni-standard-openelis-1 2>/dev/null || true
sleep 2

CURRENT_STEP=3
progress "Terminating connections..."
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='clinlims';" >/dev/null 2>&1 || true

CURRENT_STEP=4
progress "Dropping and recreating database..."
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres \
  -c "DROP DATABASE IF EXISTS clinlims;" >/dev/null 2>&1 || true
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres \
  -c "CREATE DATABASE clinlims OWNER clinlims;" 2>/dev/null

CURRENT_STEP=5
progress "Restoring from backup..."
docker cp "$FILE" bahmni-standard-openelisdb-1:/tmp/restore.sql.gz 2>/dev/null
docker exec bahmni-standard-openelisdb-1 sh -c "zcat /tmp/restore.sql.gz | psql -U clinlims -d clinlims" 2>/dev/null

CURRENT_STEP=6
progress "Restarting OpenELIS app..."
docker start bahmni-standard-openelis-1 2>/dev/null || true

printf "\r  [████████████████████] 100%% — Done!\n" | tee -a "$LOG"
echo "OpenELIS restore complete." | tee -a "$LOG"
