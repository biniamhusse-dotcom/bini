#!/bin/bash

# Restore all databases from backup
# Usage:
#   bash restore_all_databases.sh                  # restore latest
#   bash restore_all_databases.sh 20260605_125336  # restore specific date

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DATE_ARG="$1"

echo "=== RESTORE ALL DATABASES ==="
echo ""

bash "$SCRIPT_DIR/restore_openmrs.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_reports.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_odoo.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_clinlims.sh" $DATE_ARG
echo ""

bash "$SCRIPT_DIR/restore_pacsdb.sh" $DATE_ARG
echo ""

echo "=== ALL DATABASE RESTORES COMPLETE ==="
