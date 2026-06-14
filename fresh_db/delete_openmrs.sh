#!/bin/bash

# ======================
# Configuration
# ======================

SQL_FILE="deletePatientDataForOpenMRS.sql"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Container names
CONTAINER="bahmni-standard-openmrsdb-1"
APP="bahmni-standard-openmrs-1"

# DB credentials
DB_USER="root"
DB_PASSWORD="adminAdmin!123"

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

TOTAL_STEPS=3
CURRENT_STEP=0

progress() {
  local pct=$((CURRENT_STEP * 100 / TOTAL_STEPS))
  local filled=$((pct / 5))
  local empty=$((20 - filled))
  local bar=""
  for ((i=0; i<filled; i++)); do bar="${bar}█"; done
  for ((i=0; i<empty; i++)); do bar="${bar}░"; done
  printf "\r  [%s] %3d%% — %s" "$bar" "$pct" "$1"
}

# ======================
# Run Deletion
# ======================

echo -e "${CYAN}==== STARTING OPENMRS DATA DELETION ====${NOCOLOR}"

if [ ! -f "$SCRIPT_DIR/$SQL_FILE" ]; then
    echo -e "${RED}File not found: $SQL_FILE${NOCOLOR}"
    exit 1
fi

CURRENT_STEP=1
progress "Stopping OpenMRS..."
docker stop $APP

CURRENT_STEP=2
progress "Deleting OpenMRS patient data..."
docker exec -i $CONTAINER mysql -u$DB_USER -p$DB_PASSWORD openmrs < "$SCRIPT_DIR/$SQL_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to delete OpenMRS patient data${NOCOLOR}"
else
    echo -e "${GREEN}Successfully deleted OpenMRS patient data${NOCOLOR}"
fi

CURRENT_STEP=3
progress "Starting OpenMRS..."
docker start $APP

printf "\r  [████████████████████] 100%% — Done!\n"
echo -e "${CYAN}==== OPENMRS DELETION COMPLETE ====${NOCOLOR}"
