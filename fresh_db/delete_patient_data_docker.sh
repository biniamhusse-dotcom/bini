#!/bin/bash

# ======================
# Configuration
# ======================

OPENMRS_SQL_FILE="deletePatientDataForOpenMRS.sql"
OPENELIS_SQL_FILE="deletePatientDataForOpenElis.sql"
OPENERP_SQL_FILE="deletePatientDataForOpenERP.sql"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Container names
OPENMRS_CONTAINER="bahmni-standard-openmrsdb-1"
OPENELIS_CONTAINER="bahmni-standard-openelisdb-1"
OPENERP_CONTAINER="bahmni-standard-odoodb-1"

# Application service containers (to stop/start)
OPENMRS_APP="bahmni-standard-openmrs-1"
OPENELIS_APP="bahmni-standard-openelis-1"
OPENERP_APP="bahmni-standard-odoo-1"
ODOO_CONNECT="bahmni-standard-odoo-connect-1"
ATOMFEED="bahmni-standard-atomfeed-console-1"
LAB_RESULT_SYNC="lab-result-sync"

# DB credentials
OPENMRS_DB_USER="root"
OPENMRS_DB_PASSWORD="adminAdmin!123"

OPENELIS_DB_USER="clinlims"
OPENERP_DB_USER="odoo"

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

# Progress bar
TOTAL_STEPS=7
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
# Functions
# ======================

stop_services() {
    echo -e "${CYAN}Stopping Bahmni service containers...${NOCOLOR}"
    docker stop $OPENMRS_APP $OPENELIS_APP $OPENERP_APP $ODOO_CONNECT $ATOMFEED $LAB_RESULT_SYNC 2>/dev/null || true
}

start_services() {
    echo -e "${CYAN}Starting Bahmni service containers...${NOCOLOR}"
    docker start $OPENMRS_APP $OPENELIS_APP $OPENERP_APP $ODOO_CONNECT $ATOMFEED $LAB_RESULT_SYNC 2>/dev/null || true
}

delete_openmrs_data() {
    echo -e "${CYAN}Deleting OpenMRS patient data...${NOCOLOR}"

    if [ ! -f "$SCRIPT_DIR/$OPENMRS_SQL_FILE" ]; then
        echo -e "${RED}File not found: $OPENMRS_SQL_FILE${NOCOLOR}"
        return 1
    fi

    docker exec -i $OPENMRS_CONTAINER mysql -u$OPENMRS_DB_USER -p$OPENMRS_DB_PASSWORD openmrs < "$SCRIPT_DIR/$OPENMRS_SQL_FILE"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to delete OpenMRS patient data${NOCOLOR}"
    else
        echo -e "${GREEN}Successfully deleted OpenMRS patient data${NOCOLOR}"
    fi
}

delete_openelis_data() {
    echo -e "${CYAN}Deleting OpenELIS patient data...${NOCOLOR}"

    if [ ! -f "$SCRIPT_DIR/$OPENELIS_SQL_FILE" ]; then
        echo -e "${RED}File not found: $OPENELIS_SQL_FILE${NOCOLOR}"
        return 1
    fi

    docker exec -i $OPENELIS_CONTAINER psql -U $OPENELIS_DB_USER -d clinlims < "$SCRIPT_DIR/$OPENELIS_SQL_FILE"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to delete OpenELIS patient data${NOCOLOR}"
    else
        echo -e "${GREEN}Successfully deleted OpenELIS patient data${NOCOLOR}"
    fi
}

delete_openerp_data() {
    echo -e "${CYAN}Deleting OpenERP patient data...${NOCOLOR}"

    if [ ! -f "$SCRIPT_DIR/$OPENERP_SQL_FILE" ]; then
        echo -e "${RED}File not found: $OPENERP_SQL_FILE${NOCOLOR}"
        return 1
    fi

    docker exec -i $OPENERP_CONTAINER psql -U $OPENERP_DB_USER -d odoo < "$SCRIPT_DIR/$OPENERP_SQL_FILE"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to delete OpenERP patient data${NOCOLOR}"
    else
        echo -e "${GREEN}Successfully deleted OpenERP patient data${NOCOLOR}"
    fi
}

# ======================
# Run
# ======================

echo -e "${CYAN}==== STARTING PATIENT DATA DELETION ====${NOCOLOR}"

CURRENT_STEP=1
progress "Stopping services..."
stop_services

CURRENT_STEP=2
progress "Deleting OpenMRS data..."
delete_openmrs_data

CURRENT_STEP=4
progress "Deleting OpenELIS data..."
delete_openelis_data

CURRENT_STEP=5
progress "Deleting OpenERP data..."
delete_openerp_data

CURRENT_STEP=6
progress "Starting services..."
start_services

CURRENT_STEP=7
progress "Complete!" "done"

echo ""
echo -e "${CYAN}==== DELETION COMPLETE ====${NOCOLOR}"
