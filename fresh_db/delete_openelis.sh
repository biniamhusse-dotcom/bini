#!/bin/bash

# ======================
# Configuration
# ======================

SQL_FILE="deletePatientDataForOpenElis.sql"
CURDIR=$(pwd)

# Container names
CONTAINER="bahmni-standard-openelisdb-1"
APP="bahmni-standard-openelis-1"

# DB credentials
DB_USER="clinlims"

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

# ======================
# Run Deletion
# ======================

echo -e "${CYAN}==== STARTING OPENELIS DATA DELETION ====${NOCOLOR}"

if [ ! -f "$CURDIR/$SQL_FILE" ]; then
    echo -e "${RED}File not found: $SQL_FILE${NOCOLOR}"
    exit 1
fi

echo -e "${CYAN}Stopping OpenELIS service container...${NOCOLOR}"
docker stop $APP

echo -e "${CYAN}Deleting OpenELIS patient data...${NOCOLOR}"
docker exec -i $CONTAINER psql -U $DB_USER -d clinlims < "$CURDIR/$SQL_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to delete OpenELIS patient data${NOCOLOR}"
else
    echo -e "${GREEN}Successfully deleted OpenELIS patient data${NOCOLOR}"
fi

echo -e "${CYAN}Starting OpenELIS service container...${NOCOLOR}"
docker start $APP

echo -e "${CYAN}==== OPENELIS DELETION COMPLETE ====${NOCOLOR}"