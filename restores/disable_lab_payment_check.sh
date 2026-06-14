#!/bin/bash

# Remove "Not Paid Yet" check from OpenELIS lab orders page
# This makes all orders show the clickable link regardless of payment status

CONTAINER="bahmni-standard-openelis-1"
JS_FILE="/run/bahmni-lab/bahmni-lab/scripts/dashBoard/orders.js"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

echo -e "${CYAN}==== DISABLE LAB PAYMENT CHECK ====${NOCOLOR}"

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo -e "${RED}ERROR: Container $CONTAINER is not running${NOCOLOR}"
  exit 1
fi

# Step 1 — Backup
echo -e "${CYAN}Step 1: Creating backup...${NOCOLOR}"
docker exec "$CONTAINER" cp "$JS_FILE" "${JS_FILE}.backup"
if [ $? -ne 0 ]; then
  echo -e "${RED}Failed to create backup${NOCOLOR}"
  exit 1
fi
echo -e "${GREEN}Backup created: ${JS_FILE}.backup${NOCOLOR}"

# Step 2 — Apply fix
echo -e "${CYAN}Step 2: Applying fix...${NOCOLOR}"
docker exec "$CONTAINER" sed -i 's/return order.hasPaid?"<a href=.SamplePatientEntry/return "<a href='\''SamplePatientEntry/' "$JS_FILE"
docker exec "$CONTAINER" sed -i 's/+linkSample+"<\/a>":"Not Paid Yet"/+linkSample+"<\/a>"/' "$JS_FILE"

# Step 3 — Verify
echo -e "${CYAN}Step 3: Verifying...${NOCOLOR}"
RESULT=$(docker exec "$CONTAINER" grep -n "hasPaid\|Not Paid" "$JS_FILE")
if [ -z "$RESULT" ]; then
  echo -e "${GREEN}SUCCESS: hasPaid check removed. Refresh OpenELIS in browser.${NOCOLOR}"
else
  echo -e "${RED}WARNING: Found remaining references:${NOCOLOR}"
  echo "$RESULT"
fi
