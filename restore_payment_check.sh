#!/bin/bash
# restore_payment_check.sh
# Restores original payment status checking (queries Odoo/ERP for invoice status)
# Reverts config JSON files to enable payment checking

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLINICAL_APP="$SCRIPT_DIR/config/openmrs/apps/clinical/app.json"
ORDERS_APP="$SCRIPT_DIR/config/openmrs/apps/orders/app.json"

echo "=== Restoring Payment Check ==="

# Clinical app.json
if [ -f "$CLINICAL_APP" ]; then
    sed -i 's/"disable checking": true/"disable checking": false/g' "$CLINICAL_APP"
    echo "[OK] Clinical app.json: disable checking = false"
else
    echo "[SKIP] Clinical app.json not found"
fi

# Orders app.json
if [ -f "$ORDERS_APP" ]; then
    sed -i 's/"disable checking": true/"disable checking": false/g' "$ORDERS_APP"
    echo "[OK] Orders app.json: disable checking = false"
else
    echo "[SKIP] Orders app.json not found"
fi

echo ""
echo "Done. Payment status will now query the billing system."
echo "Restart Bahmni or hard refresh browser (Ctrl+Shift+R) to apply."
