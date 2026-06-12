#!/bin/bash

# ======================
# Configuration
# ======================

SQL_FILE="deletePatientDataForOpenERP.sql"
CURDIR=$(pwd)

# Container names
CONTAINER="bahmni-standard-odoodb-1"
APP="bahmni-standard-odoo-1"

# DB credentials
DB_USER="odoo"

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

# ======================
# Run Deletion
# ======================

echo -e "${CYAN}==== STARTING OPENERP DATA DELETION ====${NOCOLOR}"

if [ ! -f "$CURDIR/$SQL_FILE" ]; then
    echo -e "${RED}File not found: $SQL_FILE${NOCOLOR}"
    exit 1
fi

echo -e "${CYAN}Stopping OpenERP/Odoo service container...${NOCOLOR}"
docker stop $APP

echo -e "${CYAN}Deleting OpenERP/Odoo patient data...${NOCOLOR}"
docker exec -i $CONTAINER psql -U $DB_USER -d odoo < "$CURDIR/$SQL_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to delete OpenERP/Odoo patient data${NOCOLOR}"
else
    echo -e "${GREEN}Successfully deleted OpenERP/Odoo patient data${NOCOLOR}"
fi

echo -e "${CYAN}Starting OpenERP/Odoo service container...${NOCOLOR}"
docker start $APP

echo -e "${CYAN}==== OPENERP DELETION COMPLETE ====${NOCOLOR}"