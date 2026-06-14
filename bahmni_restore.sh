#!/bin/bash

# Usage:
#   bash bahmni_restore.sh                  # restore latest
#   bash bahmni_restore.sh 20240512_020000  # restore specific date
#
# Place backup files in ./backups/bahmni/:
#   openmrs_*.sql.gz, odoo_*.pgsql.gz, clinlims_*.pgsql.gz,
#   bahmni_reports_*.sql.gz, pacsdb_*.pgsql.gz
# Volume backups go in ./backups/bahmni/volumes/

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups/bahmni"
DATE_ARG="$1"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/restore_$(date +%Y%m%d_%H%M%S).log"

echo "=== Bahmni Restore Started: $(date) ===" | tee -a "$LOG"

# ── Find backup files ─────────────────────────────────────────────────────────

if [ -z "$DATE_ARG" ]; then
  echo "No date given — using latest backup files." | tee -a "$LOG"
  OPENMRS_FILE=$(ls -t "$BACKUP_DIR"/openmrs_*.sql.gz        2>/dev/null | head -1)
  ODOO_FILE=$(ls -t "$BACKUP_DIR"/odoo_*.pgsql.gz            2>/dev/null | head -1)
  CLINLIMS_FILE=$(ls -t "$BACKUP_DIR"/clinlims_*.pgsql.gz    2>/dev/null | head -1)
  REPORTS_FILE=$(ls -t "$BACKUP_DIR"/bahmni_reports_*.sql.gz 2>/dev/null | head -1)
  PACS_FILE=$(ls -t "$BACKUP_DIR"/pacsdb_*.pgsql.gz          2>/dev/null | head -1)
else
  OPENMRS_FILE="$BACKUP_DIR/openmrs_${DATE_ARG}.sql.gz"
  ODOO_FILE="$BACKUP_DIR/odoo_${DATE_ARG}.pgsql.gz"
  CLINLIMS_FILE="$BACKUP_DIR/clinlims_${DATE_ARG}.pgsql.gz"
  REPORTS_FILE="$BACKUP_DIR/bahmni_reports_${DATE_ARG}.sql.gz"
  PACS_FILE="$BACKUP_DIR/pacsdb_${DATE_ARG}.pgsql.gz"
fi

echo "Files to restore:" | tee -a "$LOG"
echo "  OpenMRS  : $OPENMRS_FILE"  | tee -a "$LOG"
echo "  Odoo     : $ODOO_FILE"     | tee -a "$LOG"
echo "  clinlims : $CLINLIMS_FILE" | tee -a "$LOG"
echo "  Reports  : $REPORTS_FILE"  | tee -a "$LOG"
echo "  PACS     : $PACS_FILE"     | tee -a "$LOG"

# Check all DB files exist
for F in "$OPENMRS_FILE" "$ODOO_FILE" "$CLINLIMS_FILE" "$REPORTS_FILE" "$PACS_FILE"; do
  if [ ! -f "$F" ]; then
    echo "ERROR: File not found: $F" | tee -a "$LOG"; exit 1
  fi
done

# ── Start DB containers ───────────────────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "--- Starting DB containers ---" | tee -a "$LOG"
docker start bahmni-standard-openmrsdb-1
docker start bahmni-standard-reportsdb-1
docker start bahmni-standard-odoodb-1
docker start bahmni-standard-openelisdb-1
docker start bahmni-standard-pacsdb-1

echo "Waiting for MySQL..." | tee -a "$LOG"
until docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' -e "SELECT 1" &>/dev/null; do
  echo "  openmrsdb not ready..."; sleep 3
done
until docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' -e "SELECT 1" &>/dev/null; do
  echo "  reportsdb not ready..."; sleep 3
done
echo "✓ MySQL ready." | tee -a "$LOG"

# ── Stop app containers (prevent reconnection during drop) ────────────────────

echo "" | tee -a "$LOG"
echo "--- Stopping app containers ---" | tee -a "$LOG"
docker stop bahmni-standard-odoo-1 bahmni-standard-odoo-connect-1 \
  bahmni-standard-openelis-1 2>/dev/null || true
sleep 2

# ── Restore Databases ─────────────────────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "--- DATABASE RESTORES ---" | tee -a "$LOG"

# OpenMRS
echo "Restoring OpenMRS..." | tee -a "$LOG"
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "DROP DATABASE IF EXISTS openmrs"
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "CREATE DATABASE openmrs"
docker cp "$OPENMRS_FILE" bahmni-standard-openmrsdb-1:/tmp/restore.sql.gz
docker exec bahmni-standard-openmrsdb-1 sh -c "zcat /tmp/restore.sql.gz | mysql -uroot -p'adminAdmin!123' openmrs"
echo "✓ OpenMRS exit: $?" | tee -a "$LOG"

# Bahmni Reports
echo "Restoring Bahmni Reports..." | tee -a "$LOG"
docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "DROP DATABASE IF EXISTS bahmni_reports"
docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "CREATE DATABASE bahmni_reports"
docker cp "$REPORTS_FILE" bahmni-standard-reportsdb-1:/tmp/restore.sql.gz
docker exec bahmni-standard-reportsdb-1 sh -c "zcat /tmp/restore.sql.gz | mysql -uroot -p'adminAdmin!123' bahmni_reports"
echo "✓ Reports exit: $?" | tee -a "$LOG"

# Odoo — terminate connections, drop, recreate
echo "Restoring Odoo..." | tee -a "$LOG"
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='odoo';" >/dev/null 2>&1 || true
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres \
  -c "DROP DATABASE IF EXISTS odoo;" >/dev/null 2>&1 || true
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres \
  -c "CREATE DATABASE odoo OWNER odoo;"
docker cp "$ODOO_FILE" bahmni-standard-odoodb-1:/tmp/restore.sql.gz
docker exec bahmni-standard-odoodb-1 sh -c "zcat /tmp/restore.sql.gz | psql -U odoo -d odoo"
echo "✓ Odoo exit: $?" | tee -a "$LOG"

# OpenELIS — terminate connections, drop, recreate
echo "Restoring OpenELIS..." | tee -a "$LOG"
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='clinlims';" >/dev/null 2>&1 || true
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres \
  -c "DROP DATABASE IF EXISTS clinlims;" >/dev/null 2>&1 || true
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres \
  -c "CREATE DATABASE clinlims OWNER clinlims;"
docker cp "$CLINLIMS_FILE" bahmni-standard-openelisdb-1:/tmp/restore.sql.gz
docker exec bahmni-standard-openelisdb-1 sh -c "zcat /tmp/restore.sql.gz | psql -U clinlims -d clinlims"
echo "✓ OpenELIS exit: $?" | tee -a "$LOG"

# PACS — terminate connections, drop, recreate
echo "Restoring PACS DB..." | tee -a "$LOG"
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='pacs_db';" >/dev/null 2>&1 || true
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres \
  -c "DROP DATABASE IF EXISTS pacs_db;" >/dev/null 2>&1 || true
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres \
  -c "CREATE DATABASE pacs_db OWNER pacs_user;"
docker cp "$PACS_FILE" bahmni-standard-pacsdb-1:/tmp/restore.sql.gz
docker exec bahmni-standard-pacsdb-1 sh -c "zcat /tmp/restore.sql.gz | psql -U postgres -d pacs_db"
echo "✓ PACS exit: $?" | tee -a "$LOG"

# ── Restore Volumes ───────────────────────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "--- VOLUME RESTORES ---" | tee -a "$LOG"

restore_volume() {
  local NAME=$1

  # Find latest or date-specific file
  if [ -z "$DATE_ARG" ]; then
    local FILE=$(ls -t "$BACKUP_DIR/volumes/${NAME}_"*.tar.gz 2>/dev/null | head -1)
  else
    local FILE="$BACKUP_DIR/volumes/${NAME}_${DATE_ARG}.tar.gz"
  fi

  if [ ! -f "$FILE" ]; then
    echo "  SKIP: No backup found for $NAME" | tee -a "$LOG"
    return
  fi

  echo "  Restoring volume: $NAME" | tee -a "$LOG"
  # Use docker run to restore — works on Windows without direct filesystem access
  local BACKUP_DIR_PATH
  BACKUP_DIR_PATH="$(cd "$(dirname "$FILE")" && pwd)"
  docker run --rm \
    -v "$NAME:/data" \
    -v "$BACKUP_DIR_PATH:/backup:ro" \
    busybox sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$FILE") -C /data"
  echo "  ✓ exit: $?" | tee -a "$LOG"
}

restore_volume "bahmni-standard_bahmni-document-images"
restore_volume "bahmni-standard_bahmni-patient-images"
restore_volume "bahmni-standard_bahmni-clinical-forms"
restore_volume "bahmni-standard_bahmni-lab-results"
restore_volume "bahmni-standard_bahmni-uploaded-files"
restore_volume "bahmni-standard_bahmni-queued-reports"
restore_volume "bahmni-standard_dcm4chee-archive"
restore_volume "bahmni-standard_dcm4chee-config"
restore_volume "bahmni-standard_odoofilestore"
restore_volume "bahmni-standard_odooappdata"
restore_volume "bahmni-standard_odooconfig"
restore_volume "bahmni-standard_sms-token"

echo "" | tee -a "$LOG"
echo "=== Restore Complete: $(date) ===" | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "Restarting app containers..." | tee -a "$LOG"
docker start bahmni-standard-odoo-1 bahmni-standard-odoo-connect-1 \
  bahmni-standard-openelis-1 2>/dev/null || true
echo "✓ App containers started." | tee -a "$LOG"
echo "" | tee -a "$LOG"
echo "Start full stack with:" | tee -a "$LOG"
echo "  cd bahmni-docker/bahmni-standard && docker compose --env-file .env up -d" | tee -a "$LOG"