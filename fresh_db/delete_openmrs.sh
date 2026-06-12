#!/bin/bash

# ======================
# Configuration
# ======================

SQL_FILE="deletePatientDataForOpenMRS.sql"
CURDIR=$(pwd)

# Container names
CONTAINER="bahmni-standard-openmrsdb-1"
APP="bahmni-standard-openmrs-1"

# DB credentials
DB_USER="root"
DB_PASSWORD="adminAdmin!123"  # Replace with actual password

# Console colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

# ======================
# Run Deletion
# ======================

echo -e "${CYAN}==== STARTING OPENMRS DATA DELETION ====${NOCOLOR}"

if [ ! -f "$CURDIR/$SQL_FILE" ]; then
    echo -e "${RED}File not found: $SQL_FILE${NOCOLOR}"
    exit 1
fi

echo -e "${CYAN}Stopping OpenMRS service container...${NOCOLOR}"
docker stop $APP

echo -e "${CYAN}Deleting OpenMRS patient data...${NOCOLOR}"
docker exec -i $CONTAINER mysql -u$DB_USER -p$DB_PASSWORD openmrs < "$CURDIR/$SQL_FILE"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to delete OpenMRS patient data${NOCOLOR}"
else
    echo -e "${GREEN}Successfully deleted OpenMRS patient data${NOCOLOR}"
fi

echo -e "${CYAN}Starting OpenMRS service container...${NOCOLOR}"
docker start $APP

echo -e "${CYAN}==== OPENMRS DELETION COMPLETE ====${NOCOLOR}"