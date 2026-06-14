#!/bin/bash

# ======================
# Configuration
# ======================

SQL_FILE="deletePatientDataForOpenElis.sql"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Container names
CONTAINER="bahmni-standard-openelisdb-1"
APP="bahmni-standard-openelis-1"
LAB_RESULT_SYNC="lab-result-sync"

# DB credentials
DB_USER="clinlims"

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

echo -e "${CYAN}==== STARTING OPENELIS DATA DELETION ====${NOCOLOR}"

if [ ! -f "$SCRIPT_DIR/$SQL_FILE" ]; then
    echo -e "${RED}File not found: $SQL_FILE${NOCOLOR}"
    exit 1
fi

CURRENT_STEP=1
progress "Stopping OpenELIS..."
docker stop $APP $LAB_RESULT_SYNC 2>/dev/null || true

CURRENT_STEP=2
progress "Deleting OpenELIS patient data..."
docker exec -i $CONTAINER psql -U $DB_USER -d clinlims < "$SCRIPT_DIR/$SQL_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to delete OpenELIS patient data${NOCOLOR}"
else
    echo -e "${GREEN}Successfully deleted OpenELIS patient data${NOCOLOR}"
fi

CURRENT_STEP=3
progress "Starting OpenELIS..."
docker start $APP $LAB_RESULT_SYNC 2>/dev/null || true

printf "\r  [████████████████████] 100%% — Done!\n"
echo -e "${CYAN}==== OPENELIS DELETION COMPLETE ====${NOCOLOR}"
