#!/bin/bash

# Usage:
#   bash restore_openmrs.sh                  # restore latest backup
#   bash restore_openmrs.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_openmrs_$(date +%Y%m%d_%H%M%S).log"

echo "=== OpenMRS Restore Started: $(date) ===" | tee "$LOG"

# Find backup file
if [ -z "$DATE_ARG" ]; then
  echo "No date given — using latest backup." | tee -a "$LOG"
  FILE=$(ls -t "$BACKUP_DIR"/openmrs_*.sql.gz 2>/dev/null | head -1)
else
  FILE="$BACKUP_DIR/openmrs_${DATE_ARG}.sql.gz"
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE" | tee -a "$LOG"; exit 1
fi

echo "File: $FILE" | tee -a "$LOG"

# Start container
echo "Starting openmrsdb..." | tee -a "$LOG"
docker start bahmni-standard-openmrsdb-1

echo "Waiting for MySQL..." | tee -a "$LOG"
until docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' -e "SELECT 1" &>/dev/null; do
  echo "  not ready..."; sleep 3
done
echo "MySQL ready." | tee -a "$LOG"

# Drop and recreate database
echo "Dropping and recreating database..." | tee -a "$LOG"
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "DROP DATABASE IF EXISTS openmrs"
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "CREATE DATABASE openmrs"

# Restore — copy file into container for cross-platform compatibility
echo "Restoring..." | tee -a "$LOG"
docker cp "$FILE" bahmni-standard-openmrsdb-1:/tmp/restore.sql.gz
docker exec bahmni-standard-openmrsdb-1 sh -c "zcat /tmp/restore.sql.gz | mysql -uroot -p'adminAdmin!123' openmrs"

echo "OpenMRS restore complete. Exit: $?" | tee -a "$LOG"
