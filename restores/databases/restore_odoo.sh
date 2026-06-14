#!/bin/bash

# Usage:
#   bash restore_odoo.sh                  # restore latest backup
#   bash restore_odoo.sh 20260605_125336  # restore specific date

BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
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

echo "Stopping Odoo app to prevent reconnections..." | tee -a "$LOG"
docker stop bahmni-standard-odoo-1 bahmni-standard-odoo-connect-1 2>/dev/null || true
sleep 2

echo "Terminating connections and recreating database..." | tee -a "$LOG"
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='odoo';" >/dev/null 2>&1 || true
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres \
  -c "DROP DATABASE IF EXISTS odoo;" >/dev/null 2>&1 || true
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres \
  -c "CREATE DATABASE odoo OWNER odoo;"

echo "Restoring..." | tee -a "$LOG"
docker cp "$FILE" bahmni-standard-odoodb-1:/tmp/restore.sql.gz
docker exec bahmni-standard-odoodb-1 sh -c "zcat /tmp/restore.sql.gz | psql -U odoo -d odoo"

echo "Restarting Odoo app..." | tee -a "$LOG"
docker start bahmni-standard-odoo-1 bahmni-standard-odoo-connect-1 2>/dev/null || true

echo "Odoo restore complete. Exit: $?" | tee -a "$LOG"
