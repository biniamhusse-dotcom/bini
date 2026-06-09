#!/bin/bash

# ======================
# Configuration
# ======================

OPENMRS_SQL_FILE="deletePatientDataForOpenMRS.sql"
OPENELIS_SQL_FILE="deletePatientDataForOpenElis.sql"
OPENERP_SQL_FILE="deletePatientDataForOpenERP.sql"
CURDIR=$(pwd)

# Container names
OPENMRS_CONTAINER="bahmni-standard-openmrsdb-1"
OPENELIS_CONTAINER="bahmni-standard-openelisdb-1"
OPENERP_CONTAINER="bahmni-standard-odoodb-1"

# Application service containers (to stop/start)
OPENMRS_APP="bahmni-standard-openmrs-1"
OPENELIS_APP="bahmni-standard-openelis-1"
OPENERP_APP="bahmni-standard-odoo-1"

# DB credentials
OPENMRS_DB_USER="root"
OPENMRS_DB_PASSWORD="adminAdmin!123"  # Replace with actual password

OPENELIS_DB_USER="clinlims"
OPENERP_DB_USER="odoo"

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

# ======================
# Functions
# ======================

stop_services() {
    echo -e "${CYAN}Stopping Bahmni service containers...${NOCOLOR}"
    docker stop $OPENMRS_APP
    docker stop $OPENELIS_APP
    docker stop $OPENERP_APP
}

start_services() {
    echo -e "${CYAN}Starting Bahmni service containers...${NOCOLOR}"
    docker start $OPENMRS_APP
    docker start $OPENELIS_APP
    docker start $OPENERP_APP
}

delete_openmrs_data() {
    echo -e "${CYAN}Deleting OpenMRS patient data...${NOCOLOR}"

    if [ ! -f "$CURDIR/$OPENMRS_SQL_FILE" ]; then
        echo -e "${RED}File not found: $OPENMRS_SQL_FILE${NOCOLOR}"
        return 1
    fi

    docker exec -i $OPENMRS_CONTAINER mysql -u$OPENMRS_DB_USER -p$OPENMRS_DB_PASSWORD openmrs < "$CURDIR/$OPENMRS_SQL_FILE"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to delete OpenMRS patient data${NOCOLOR}"
    else
        echo -e "${GREEN}Successfully deleted OpenMRS patient data${NOCOLOR}"
    fi
}

delete_openelis_data() {
    echo -e "${CYAN}Deleting OpenELIS patient data...${NOCOLOR}"

    if [ ! -f "$CURDIR/$OPENELIS_SQL_FILE" ]; then
        echo -e "${RED}File not found: $OPENELIS_SQL_FILE${NOCOLOR}"
        return 1
    fi

    docker exec -i $OPENELIS_CONTAINER psql -U $OPENELIS_DB_USER -d clinlims < "$CURDIR/$OPENELIS_SQL_FILE"
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to delete OpenELIS patient data${NOCOLOR}"
    else
        echo -e "${GREEN}Successfully deleted OpenELIS patient data${NOCOLOR}"
    fi
}

delete_openerp_data() {
    echo -e "${CYAN}Deleting OpenERP patient data...${NOCOLOR}"

    if [ ! -f "$CURDIR/$OPENERP_SQL_FILE" ]; then
        echo -e "${RED}File not found: $OPENERP_SQL_FILE${NOCOLOR}"
        return 1
    fi

    docker exec -i $OPENERP_CONTAINER psql -U $OPENERP_DB_USER -d odoo < "$CURDIR/$OPENERP_SQL_FILE"
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
stop_services

delete_openmrs_data
delete_openelis_data
delete_openerp_data

start_services
echo -e "${CYAN}==== DELETION COMPLETE ====${NOCOLOR}"