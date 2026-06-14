#!/bin/bash

# Usage:
#   bash restore_reports.sh                  # restore latest backup
#   bash restore_reports.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_reports_$(date +%Y%m%d_%H%M%S).log"

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

echo "Starting reportsdb..." | tee -a "$LOG"
docker start bahmni-standard-reportsdb-1

echo "Waiting for MySQL..." | tee -a "$LOG"
until docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' -e "SELECT 1" &>/dev/null; do
  echo "  not ready..."; sleep 3
done
echo "MySQL ready." | tee -a "$LOG"

echo "Dropping and recreating database..." | tee -a "$LOG"
docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "DROP DATABASE IF EXISTS bahmni_reports; CREATE DATABASE bahmni_reports;"

echo "Restoring..." | tee -a "$LOG"
zcat "$FILE" | docker exec -i bahmni-standard-reportsdb-1 \
  mysql -uroot -p'adminAdmin!123' bahmni_reports

echo "Reports restore complete. Exit: $?" | tee -a "$LOG"
