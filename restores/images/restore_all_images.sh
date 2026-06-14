#!/bin/bash

# Restore all Docker images from backup
# Usage: bash restore_all_images.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== RESTORE ALL IMAGES ==="
echo ""

bash "$SCRIPT_DIR/restore_bahmni_openmrs-db.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_openelis-db.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_odoo-16-db.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_reports.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_proxy.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_dcm4chee.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_pacs-integration.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_appointments.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_atomfeed-console.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_implementer-interface.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_microfrontend-ipd.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_odoo-connect.sh"
echo ""

bash "$SCRIPT_DIR/restore_bahmni_patient-documents.sh"
echo ""

bash "$SCRIPT_DIR/restore_selamsew_bahmni-web.sh"
echo ""

bash "$SCRIPT_DIR/restore_selamsew_openmrs.sh"
echo ""

bash "$SCRIPT_DIR/restore_selamsew_openelis.sh"
echo ""

bash "$SCRIPT_DIR/restore_selamsew_odoo-16.sh"
echo ""

bash "$SCRIPT_DIR/restore_selamsew_global_property.sh"
echo ""

bash "$SCRIPT_DIR/restore_selamsew_lab-result-sync.sh"
echo ""

bash "$SCRIPT_DIR/restore_mysql.sh"
echo ""

bash "$SCRIPT_DIR/restore_postgres.sh"
echo ""

echo "=== ALL IMAGE RESTORES COMPLETE ==="
