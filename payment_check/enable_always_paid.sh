#!/bin/bash
# enable_always_paid.sh
# Sets payment status to always show "Paid" on clinical and orders pages
# Modifies config JSON files to disable payment checking

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLINICAL_APP="$SCRIPT_DIR/../config/openmrs/apps/clinical/app.json"
ORDERS_APP="$SCRIPT_DIR/../config/openmrs/apps/orders/app.json"

echo "=== Enabling Always Paid ==="

# Clinical app.json
if [ -f "$CLINICAL_APP" ]; then
    sed -i 's/"disable checking": false/"disable checking": true/g' "$CLINICAL_APP"
    echo "[OK] Clinical app.json: disable checking = true"
else
    echo "[SKIP] Clinical app.json not found"
fi

# Orders app.json
if [ -f "$ORDERS_APP" ]; then
    sed -i 's/"disable checking": false/"disable checking": true/g' "$ORDERS_APP"
    echo "[OK] Orders app.json: disable checking = true"
else
    echo "[SKIP] Orders app.json not found"
fi

echo ""
echo "Done. All patients will now show 'Paid' status."
echo "Restart Bahmni or hard refresh browser (Ctrl+Shift+R) to apply."
