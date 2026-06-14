#!/bin/bash

# Reset MRN sequence to start from a given number

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NOCOLOR='\033[0m'

echo -e "${CYAN}=== MRN Sequence Reset ===${NOCOLOR}"
echo ""

# Show current value
echo -e "${CYAN}Current MRN sequence:${NOCOLOR}"
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' openmrs \
  -e "SELECT * FROM idgen_seq_id_gen;" 2>/dev/null

echo ""
read -p "Enter starting MRN number: " MRN_NUM

if [ -z "$MRN_NUM" ] || ! [[ "$MRN_NUM" =~ ^[0-9]+$ ]]; then
  echo -e "${RED}Invalid number. Please enter a numeric value.${NOCOLOR}"
  exit 1
fi

echo ""
echo -e "${CYAN}Setting next MRN to: ${MRN_NUM}${NOCOLOR}"

docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' openmrs \
  -e "UPDATE idgen_seq_id_gen SET next_sequence_value = $MRN_NUM;" 2>/dev/null

echo ""
echo -e "${GREEN}Updated MRN sequence:${NOCOLOR}"
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' openmrs \
  -e "SELECT * FROM idgen_seq_id_gen;" 2>/dev/null

echo ""
echo -e "${GREEN}Done. Next patient MRN will start from ${MRN_NUM}.${NOCOLOR}"
