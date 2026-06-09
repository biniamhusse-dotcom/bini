#!/bin/bash

BACKUP_DIR="/opt/backups/bahmni"
DATE=$(date +%Y%m%d_%H%M%S)
LOG="$BACKUP_DIR/backup_$DATE.log"
VOL_BASE="/var/lib/docker/volumes"

mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/volumes"
mkdir -p "$BACKUP_DIR/images"

echo "=== Bahmni Backup Started: $DATE ===" | tee -a "$LOG"
echo "Free disk space before backup:" | tee -a "$LOG"
df -h "$BACKUP_DIR" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# ── Databases ─────────────────────────────────────────────────────────────────

echo "--- DATABASE BACKUPS ---" | tee -a "$LOG"

# OpenMRS (MySQL)
echo "Backing up OpenMRS..." | tee -a "$LOG"
docker exec bahmni-standard-openmrsdb-1 mysqldump -uroot -p'adminAdmin!123' openmrs \
  | gzip > "$BACKUP_DIR/openmrs_$DATE.sql.gz"
echo "✓ OpenMRS exit: $?" | tee -a "$LOG"

# Odoo (PostgreSQL)
echo "Backing up Odoo..." | tee -a "$LOG"
docker exec bahmni-standard-odoodb-1 pg_dump -U odoo -d odoo \
  | gzip > "$BACKUP_DIR/odoo_$DATE.pgsql.gz"
echo "✓ Odoo exit: $?" | tee -a "$LOG"

# OpenELIS (PostgreSQL)
echo "Backing up OpenELIS..." | tee -a "$LOG"
docker exec bahmni-standard-openelisdb-1 pg_dump -U clinlims -d clinlims \
  | gzip > "$BACKUP_DIR/clinlims_$DATE.pgsql.gz"
echo "✓ OpenELIS exit: $?" | tee -a "$LOG"

# Bahmni Reports (MySQL)
echo "Backing up Bahmni Reports..." | tee -a "$LOG"
docker exec bahmni-standard-reportsdb-1 mysqldump -uroot -p'adminAdmin!123' bahmni_reports \
  | gzip > "$BACKUP_DIR/bahmni_reports_$DATE.sql.gz"
echo "✓ Reports exit: $?" | tee -a "$LOG"

# PACS DB (PostgreSQL)
echo "Backing up PACS DB..." | tee -a "$LOG"
docker exec bahmni-standard-pacsdb-1 pg_dump -U postgres -d pacs_db \
  | gzip > "$BACKUP_DIR/pacsdb_$DATE.pgsql.gz"
echo "✓ PACS DB exit: $?" | tee -a "$LOG"

# ── File Volumes ──────────────────────────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "--- VOLUME BACKUPS ---" | tee -a "$LOG"

backup_volume() {
  local NAME=$1
  local SRC="$VOL_BASE/$NAME/_data"
  local DEST="$BACKUP_DIR/volumes/${NAME}_$DATE.tar.gz"
  echo "Backing up volume: $NAME" | tee -a "$LOG"
  tar -czf "$DEST" -C "$SRC" . 2>>"$LOG"
  echo "✓ $NAME exit: $? — size: $(du -sh $DEST | cut -f1)" | tee -a "$LOG"
}

# Patient & clinical files
backup_volume "bahmni-standard_bahmni-document-images"
backup_volume "bahmni-standard_bahmni-patient-images"
backup_volume "bahmni-standard_bahmni-clinical-forms"
backup_volume "bahmni-standard_bahmni-lab-results"
backup_volume "bahmni-standard_bahmni-uploaded-files"
backup_volume "bahmni-standard_bahmni-queued-reports"

# PACS DICOM images
backup_volume "bahmni-standard_dcm4chee-archive"
backup_volume "bahmni-standard_dcm4chee-config"

# Odoo file storage
backup_volume "bahmni-standard_odoofilestore"
backup_volume "bahmni-standard_odooappdata"
backup_volume "bahmni-standard_odooconfig"

# SMS token
backup_volume "bahmni-standard_sms-token"

# ── Docker Images ─────────────────────────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "--- DOCKER IMAGE BACKUPS ---" | tee -a "$LOG"

for IMAGE in \
  "selamsew/openmrs:1.1.1-uog-1.0.2" \
  "selamsew/odoo-16:1.0.0-uog-1.0.3" \
  "selamsew/openelis:1.0.0-uog-1.0.5" \
  "selamsew/bahmni-web:1.1.0-uog-1.0.0" \
  "selamsew/lab-result-sync:1.0.2-remove-validation" \
  "selamsew/global_property:uog-1.0.2" \
  "bahmni/patient-documents:1.1.1" \
  "bahmni/implementer-interface:1.1.1" \
  "bahmni/reports:1.1.0" \
  "bahmni/odoo-connect:1.0.0" \
  "bahmni/proxy:1.1.0" \
  "bahmni/dcm4chee:1.0.0" \
  "bahmni/pacs-integration:1.0.0" \
  "bahmni/microfrontend-ipd:1.0.0" \
  "bahmni/appointments:1.1.1" \
  "bahmni/atomfeed-console:1.0.0" \
  "bahmni/openmrs-db:1.0.0-standard" \
  "bahmni/odoo-16-db:1.0.0-standard" \
  "bahmni/openelis-db:1.0.0-standard" \
  "postgres:9.6" \
  "mysql:8.0"
do
  SAFE_NAME=$(echo "$IMAGE" | tr '/:' '__')
  # Skip if already backed up
  if [ -f "$BACKUP_DIR/images/${SAFE_NAME}.tar.gz" ]; then
    echo "  Skipping (already exists): $IMAGE" | tee -a "$LOG"
    continue
  fi
  echo "  Saving image: $IMAGE" | tee -a "$LOG"
  docker save "$IMAGE" | gzip > "$BACKUP_DIR/images/${SAFE_NAME}.tar.gz"
  echo "  ✓ exit: $? — size: $(du -sh $BACKUP_DIR/images/${SAFE_NAME}.tar.gz | cut -f1)" | tee -a "$LOG"
done

# ── Cleanup old backups (keep 7 days) ────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "--- CLEANUP (files older than 7 days) ---" | tee -a "$LOG"
find "$BACKUP_DIR"         -maxdepth 1 -name "*.sql.gz"   -mtime +7 -delete
find "$BACKUP_DIR"         -maxdepth 1 -name "*.pgsql.gz" -mtime +7 -delete
find "$BACKUP_DIR"         -maxdepth 1 -name "*.log"      -mtime +7 -delete
find "$BACKUP_DIR/volumes" -maxdepth 1 -name "*.tar.gz"   -mtime +7 -delete
echo "✓ Cleanup done." | tee -a "$LOG"

# ── Summary ───────────────────────────────────────────────────────────────────

echo "" | tee -a "$LOG"
echo "=== Backup Complete: $(date) ===" | tee -a "$LOG"
echo "--- Database backups ---" | tee -a "$LOG"
ls -lh "$BACKUP_DIR"/*.gz 2>/dev/null | tee -a "$LOG"
echo "--- Volume backups ---" | tee -a "$LOG"
ls -lh "$BACKUP_DIR/volumes/" | tee -a "$LOG"
echo "--- Docker images ---" | tee -a "$LOG"
ls -lh "$BACKUP_DIR/images/" | tee -a "$LOG"
echo "--- Total backup size ---" | tee -a "$LOG"
du -sh "$BACKUP_DIR" | tee -a "$LOG"
echo "--- Free disk space after backup ---" | tee -a "$LOG"
df -h "$BACKUP_DIR" | tee -a "$LOG"