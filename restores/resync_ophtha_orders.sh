#!/bin/bash

# Re-sync Ophtha orders to Odoo by creating new atomfeed events
# for encounters containing Ophtha orders
# Run this after adding Ophtha Order type to Odoo

CONTAINER="bahmni-standard-openmrsdb-1"
DB_USER="root"
DB_PASS="adminAdmin!123"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

echo -e "${CYAN}==== RE-SYNC OPHTHA ORDERS TO ODOO ====${NOCOLOR}"

# Find encounters with Ophtha orders that need re-syncing
echo -e "${CYAN}Finding encounters with Ophtha orders...${NOCOLOR}"
ENCOUNTERS=$(docker exec "$CONTAINER" mysql -u$DB_USER -p$DB_PASS openmrs -N -e \
  "SELECT DISTINCT o.encounter_id FROM orders o 
   JOIN order_type ot ON o.order_type_id = ot.order_type_id 
   WHERE ot.name = 'Ophtha Order' AND o.voided = 0;" 2>/dev/null)

if [ -z "$ENCOUNTERS" ]; then
  echo -e "${RED}No Ophtha orders found${NOCOLOR}"
  exit 1
fi

echo -e "${GREEN}Found encounters: $ENCOUNTERS${NOCOLOR}"

# Create new event records for each encounter to trigger re-sync
for ENC_ID in $ENCOUNTERS; do
  echo -e "${CYAN}Creating event for encounter $ENC_ID...${NOCOLOR}"
  docker exec "$CONTAINER" mysql -u$DB_USER -p$DB_PASS openmrs -e \
    "INSERT INTO event_records (uuid, title, timestamp, uri, category, date_created)
     SELECT UUID(), 'Encounter', NOW(), 
            CONCAT('/openmrs/ws/rest/v1/bahmnicore/bahmniencounter/', encounter_id, '?includeAll=true'),
            'Encounter', NOW()
     FROM encounter WHERE encounter_id = $ENC_ID;" 2>/dev/null
  echo -e "${GREEN}  Event created for encounter $ENC_ID${NOCOLOR}"
done

echo ""
echo -e "${GREEN}Done. The atomfeed scheduler will pick up these events within 2 seconds.${NOCOLOR}"
echo -e "${GREEN}Check Odoo for the synced orders in a few minutes.${NOCOLOR}"
