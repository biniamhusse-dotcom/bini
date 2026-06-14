#!/bin/bash

# Restore all volumes from backup
# Usage:
#   bash restore_all_volumes.sh                  # restore latest
#   bash restore_all_volumes.sh 20260605_125336  # restore specific date

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATE_ARG="$1"

echo "=== RESTORE ALL VOLUMES ==="
echo ""

bash "$SCRIPT_DIR/restore_bahmni-document-images.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_bahmni-patient-images.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_bahmni-clinical-forms.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_bahmni-lab-results.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_bahmni-uploaded-files.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_bahmni-queued-reports.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_dcm4chee-archive.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_dcm4chee-config.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_odoofilestore.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_odooappdata.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_odooconfig.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_sms-token.sh" $DATE_ARG
echo ""

echo "=== ALL VOLUME RESTORES COMPLETE ==="
