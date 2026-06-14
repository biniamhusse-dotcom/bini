#!/bin/bash

# Usage:
#   bash restore_reports.sh                  # restore latest backup
#   bash restore_reports.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_reports_$(date +%Y%m%d_%H%M%S).log"

TOTAL_STEPS=4
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

echo "=== Bahmni Reports Restore Started: $(date) ===" | tee "$LOG"

if [ -z "$DATE_ARG" ]; then
  echo "No date given — using latest backup." | tee -a "$LOG"
  FILE=$(ls -t "$BACKUP_DIR"/bahmni_reports_*.sql.gz 2>/dev/null | head -1)
else
  FILE="$BACKUP_DIR/bahmni_reports_${DATE_ARG}.sql.gz"
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE" | tee -a "$LOG"; exit 1
fi

echo "File: $FILE" | tee -a "$LOG"

CURRENT_STEP=1
progress "Starting reportsdb..."
docker start bahmni-standard-reportsdb-1 >/dev/null 2>&1

until docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' -e "SELECT 1" &>/dev/null; do
  sleep 3
done

CURRENT_STEP=2
progress "Dropping and recreating database..."
docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "DROP DATABASE IF EXISTS bahmni_reports" 2>/dev/null
docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "CREATE DATABASE bahmni_reports" 2>/dev/null

CURRENT_STEP=3
progress "Restoring from backup..."
docker cp "$FILE" bahmni-standard-reportsdb-1:/tmp/restore.sql.gz 2>/dev/null
docker exec bahmni-standard-reportsdb-1 sh -c "zcat /tmp/restore.sql.gz | mysql -uroot -p'adminAdmin!123' bahmni_reports" 2>/dev/null

CURRENT_STEP=4
progress "Done!"

printf "\r  [████████████████████] 100%% — Done!\n" | tee -a "$LOG"
echo "Bahmni Reports restore complete." | tee -a "$LOG"
