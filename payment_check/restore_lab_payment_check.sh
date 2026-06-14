#!/bin/bash

# Restore "Not Paid Yet" check to OpenELIS lab orders page
# This reverts the payment check so orders show "Not Paid Yet" if unpaid

CONTAINER="bahmni-standard-openelis-1"
JS_FILE="/run/bahmni-lab/bahmni-lab/scripts/dashBoard/orders.js"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

echo -e "${CYAN}==== RESTORE LAB PAYMENT CHECK ====${NOCOLOR}"

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}ERROR: Container $CONTAINER is not running${NOCOLOR}"
  exit 1
fi

# Step 1 — Copy file out of container
echo -e "${CYAN}Step 1: Copying orders.js from container...${NOCOLOR}"
docker cp "${CONTAINER}:${JS_FILE}" /tmp/orders.js
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to copy file from container${NOCOLOR}"
  exit 1
fi

# Step 2 — Apply fix using awk
echo -e "${CYAN}Step 2: Restoring hasPaid check...${NOCOLOR}"
awk '
/SamplePatientEntry/ && (!/hasPaid/) {
    print "        return order.hasPaid?\"<a href='\''SamplePatientEntry.do?id=\"+ order.orderId +\"&patientId=\" + order.stNumber + \"'\''>\"+linkSample+\"</a>\":\"Not Paid Yet\";"
    next
}
{ print }
' /tmp/orders.js > /tmp/orders_fixed.js

if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to process file${NOCOLOR}"
  exit 1
fi

# Step 3 — Copy fixed file back into container
echo -e "${CYAN}Step 3: Copying fixed file back...${NOCOLOR}"
docker cp /tmp/orders_fixed.js "${CONTAINER}:${JS_FILE}"
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to copy file back to container${NOCOLOR}"
  exit 1
fi

# Step 4 — Verify
echo -e "${CYAN}Step 4: Verifying...${NOCOLOR}"
FOUND=$(MSYS_NO_PATHCONV=1 docker exec "$CONTAINER" grep -n "hasPaid\|Not Paid" "$JS_FILE")
if [ -n "$FOUND" ]; then
  echo -e "${GREEN}SUCCESS: Payment check restored. Refresh OpenELIS in browser.${NOCOLOR}"
  echo "$FOUND"
else
  echo -e "${RED}WARNING: Could not verify restoration. Check file manually.${NOCOLOR}"
fi

# Cleanup
rm -f /tmp/orders.js /tmp/orders_fixed.js
