#!/bin/bash

# Usage:
#   bash restore_odoo.sh                  # restore latest backup
#   bash restore_odoo.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
DATE_ARG="$1"
LOG="$BACKUP_DIR/restore_odoo_$(date +%Y%m%d_%H%M%S).log"

echo "=== Odoo Restore Started: $(date) ===" | tee "$LOG"

if [ -z "$DATE_ARG" ]; then
  echo "No date given — using latest backup." | tee -a "$LOG"
  FILE=$(ls -t "$BACKUP_DIR"/odoo_*.pgsql.gz 2>/dev/null | head -1)
else
  FILE="$BACKUP_DIR/odoo_${DATE_ARG}.pgsql.gz"
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE" | tee -a "$LOG"; exit 1
fi

echo "File: $FILE" | tee -a "$LOG"

echo "Starting odoodb..." | tee -a "$LOG"
docker start bahmni-standard-odoodb-1

echo "Waiting for PostgreSQL..." | tee -a "$LOG"
until docker exec bahmni-standard-odoodb-1 pg_isready -U odoo &>/dev/null; do
  echo "  not ready..."; sleep 3
done
echo "PostgreSQL ready." | tee -a "$LOG"

echo "Dropping and recreating database..." | tee -a "$LOG"
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres \
  -c "DROP DATABASE IF EXISTS odoo; CREATE DATABASE odoo OWNER odoo;"

echo "Restoring..." | tee -a "$LOG"
zcat "$FILE" | docker exec -i bahmni-standard-odoodb-1 psql -U odoo -d odoo

echo "Odoo restore complete. Exit: $?" | tee -a "$LOG"
