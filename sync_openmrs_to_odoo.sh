#!/bin/bash

# Sync patients and products from OpenMRS to Odoo
# Queries OpenMRS MySQL directly, POSTs to Odoo REST API

ODOO_URL="http://erp-localhost:8186"
ODOO_USER="emrsync"
ODOO_PASS="Admin123"

OPENMRS_DB="bahmni-standard-openmrsdb-1"
OPENMRS_MYSQL_PASS="adminAdmin!123"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NOCOLOR='\033[0m'

SUCCESS=0
FAILED=0

TMPDIR=$(mktemp -d)
COOKIE_FILE="$TMPDIR/odoo_cookie.txt"
trap "rm -rf $TMPDIR" EXIT

# ── Get Odoo auth cookie ──────────────────────────────────────────────────────

echo -e "${CYAN}Authenticating with Odoo...${NOCOLOR}"
curl.exe -s -c "$COOKIE_FILE" -X POST "$ODOO_URL/web/session/authenticate" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"call\",\"params\":{\"login\":\"$ODOO_USER\",\"password\":\"$ODOO_PASS\",\"db\":\"odoo\"}}" \
  > /dev/null 2>&1

if [ ! -f "$COOKIE_FILE" ] || ! grep -q "session_id" "$COOKIE_FILE"; then
  echo -e "${RED}Failed to authenticate with Odoo. Is Odoo running?${NOCOLOR}"
  exit 1
fi
echo -e "${GREEN}Odoo authenticated${NOCOLOR}"
echo ""

# ── Helper: query OpenMRS MySQL ───────────────────────────────────────────────

mysql_query() {
  docker exec "$OPENMRS_DB" mysql -uroot -p"$OPENMRS_MYSQL_PASS" openmrs -N -e "$1" 2>/dev/null
}

# ── Helper: post to Odoo ──────────────────────────────────────────────────────

post_to_odoo() {
  local endpoint="$1"
  local payload="$2"
  local result
  result=$(curl.exe -s -b "$COOKIE_FILE" -X POST "$ODOO_URL$endpoint" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)
  if echo "$result" | grep -qE '"status":[ ]*200'; then
    return 0
  else
    echo -e "\n  ${RED}API response: $result${NOCOLOR}" >&2
    return 1
  fi
}

# ── 1. Sync Patients ─────────────────────────────────────────────────────────

echo -e "${CYAN}=== Syncing Patients ===${NOCOLOR}"

PATIENT_IDS=$(mysql_query "SELECT patient_id FROM patient WHERE voided = 0 ORDER BY patient_id;")
PATIENT_COUNT=$(echo "$PATIENT_IDS" | grep -c '[0-9]')
echo -e "  Found ${YELLOW}$PATIENT_COUNT${NOCOLOR} patients"

SUCCESS=0
FAILED=0

for PID in $PATIENT_IDS; do
  PATIENT_DATA=$(mysql_query "
    SELECT
      p.uuid,
      CONCAT(COALESCE(pn.given_name,''), ' ', COALESCE(pn.middle_name,''), ' ', COALESCE(pn.family_name,'')) AS name,
      COALESCE(pi.identifier, '') AS identifier,
      COALESCE(pa.city_village, '') AS phone
    FROM person p
    JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0
    LEFT JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided = 0
    LEFT JOIN person_address pa ON p.person_id = pa.person_id AND pa.voided = 0
    WHERE p.person_id = $PID AND p.voided = 0
    LIMIT 1;
  ")

  if [ -z "$PATIENT_DATA" ]; then
    FAILED=$((FAILED + 1))
    continue
  fi

  UUID=$(echo "$PATIENT_DATA" | cut -f1)
  NAME=$(echo "$PATIENT_DATA" | cut -f2 | sed 's/"/\\"/g; s/^[[:space:]]*//; s/[[:space:]]*$//')
  IDENTIFIER=$(echo "$PATIENT_DATA" | cut -f3)
  PHONE=$(echo "$PATIENT_DATA" | cut -f4)

  if [ -z "$UUID" ] || [ -z "$IDENTIFIER" ]; then
    FAILED=$((FAILED + 1))
    continue
  fi

  PAYLOAD="{\"category\":\"create.customer\",\"ref\":\"$IDENTIFIER\",\"name\":\"$NAME\",\"uuid\":\"$UUID\",\"primaryContact\":\"$PHONE\",\"attributes\":{},\"preferredAddress\":{}}"

  if post_to_odoo "/api/bahmni-customer" "$PAYLOAD"; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
  fi

  printf "\r  Patients: %d synced, %d failed" "$SUCCESS" "$FAILED"
done

echo ""
echo -e "  ${GREEN}Patients done: $SUCCESS synced, $FAILED failed${NOCOLOR}"
echo ""

# ── 2. Sync Drugs ────────────────────────────────────────────────────────────

echo -e "${CYAN}=== Syncing Drugs ===${NOCOLOR}"

DRUG_IDS=$(mysql_query "SELECT drug_id FROM drug WHERE retired = 0 ORDER BY drug_id;")
DRUG_COUNT=$(echo "$DRUG_IDS" | grep -c '[0-9]')
echo -e "  Found ${YELLOW}$DRUG_COUNT${NOCOLOR} drugs"

SUCCESS=0
FAILED=0

for DID in $DRUG_IDS; do
  DRUG_DATA=$(mysql_query "
    SELECT
      d.uuid,
      d.name,
      COALESCE(c.name, 'General') AS dosage_form
    FROM drug d
    LEFT JOIN concept_name c ON d.dosage_form = c.concept_id AND c.concept_name_type = 'FULLY_SPECIFIED' AND c.voided = 0
    WHERE d.drug_id = $DID AND d.retired = 0
    LIMIT 1;
  ")

  if [ -z "$DRUG_DATA" ]; then
    FAILED=$((FAILED + 1))
    continue
  fi

  UUID=$(echo "$DRUG_DATA" | cut -f1)
  NAME=$(echo "$DRUG_DATA" | cut -f2 | sed 's/"/\\"/g')
  DOSAGE_FORM=$(echo "$DRUG_DATA" | cut -f3 | sed 's/"/\\"/g')

  if [ -z "$UUID" ] || [ -z "$NAME" ]; then
    FAILED=$((FAILED + 1))
    continue
  fi

  PAYLOAD="{\"category\":\"create.drug\",\"uuid\":\"$UUID\",\"name\":\"$NAME\",\"shortName\":\"$NAME\",\"genericName\":\"$NAME\",\"dosageForm\":\"$DOSAGE_FORM\"}"

  if post_to_odoo "/api/bahmni-drug" "$PAYLOAD"; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
  fi

  printf "\r  Drugs: %d synced, %d failed" "$SUCCESS" "$FAILED"
done

echo ""
echo -e "  ${GREEN}Drugs done: $SUCCESS synced, $FAILED failed${NOCOLOR}"
echo ""

# ── 3. Sync Lab Tests ────────────────────────────────────────────────────────

echo -e "${CYAN}=== Syncing Lab Tests ===${NOCOLOR}"

TEST_UUIDS=$(mysql_query "
  SELECT DISTINCT c.uuid
  FROM concept c
  JOIN concept_class cc ON c.class_id = cc.concept_class_id
  WHERE cc.name = 'Test' AND c.retired = 0
  ORDER BY c.concept_id;
")
TEST_COUNT=$(echo "$TEST_UUIDS" | grep -c '[0-9]')
echo -e "  Found ${YELLOW}$TEST_COUNT${NOCOLOR} lab tests"

SUCCESS=0
FAILED=0

for TUUID in $TEST_UUIDS; do
  TEST_DATA=$(mysql_query "
    SELECT
      c.uuid,
      cn.name,
      c.retired
    FROM concept c
    JOIN concept_name cn ON c.concept_id = cn.concept_id
      AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
    WHERE c.uuid = '$TUUID'
    LIMIT 1;
  ")

  if [ -z "$TEST_DATA" ]; then
    FAILED=$((FAILED + 1))
    continue
  fi

  NAME=$(echo "$TEST_DATA" | cut -f2 | sed 's/"/\\"/g')
  RETIRED=$(echo "$TEST_DATA" | cut -f3)

  if [ "$RETIRED" = "1" ]; then IS_ACTIVE="false"; else IS_ACTIVE="true"; fi

  PAYLOAD="{\"category\":\"create.lab.test\",\"uuid\":\"$TUUID\",\"name\":\"$NAME\",\"is_active\":$IS_ACTIVE,\"product_category\":\"Test\"}"

  if post_to_odoo "/api/bahmni-lab-test" "$PAYLOAD"; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
  fi

  printf "\r  Lab Tests: %d synced, %d failed" "$SUCCESS" "$FAILED"
done

echo ""
echo -e "  ${GREEN}Lab Tests done: $SUCCESS synced, $FAILED failed${NOCOLOR}"
echo ""

# ── 4. Sync Lab Panels ───────────────────────────────────────────────────────

echo -e "${CYAN}=== Syncing Lab Panels ===${NOCOLOR}"

PANEL_UUIDS=$(mysql_query "
  SELECT DISTINCT c.uuid
  FROM concept c
  JOIN concept_class cc ON c.class_id = cc.concept_class_id
  WHERE cc.name = 'LabSet' AND c.retired = 0
  ORDER BY c.concept_id;
")
PANEL_COUNT=$(echo "$PANEL_UUIDS" | grep -c '[0-9]')
echo -e "  Found ${YELLOW}$PANEL_COUNT${NOCOLOR} lab panels"

SUCCESS=0
FAILED=0

for PUUID in $PANEL_UUIDS; do
  PANEL_DATA=$(mysql_query "
    SELECT
      c.uuid,
      cn.name,
      c.retired
    FROM concept c
    JOIN concept_name cn ON c.concept_id = cn.concept_id
      AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
    WHERE c.uuid = '$PUUID'
    LIMIT 1;
  ")

  if [ -z "$PANEL_DATA" ]; then
    FAILED=$((FAILED + 1))
    continue
  fi

  NAME=$(echo "$PANEL_DATA" | cut -f2 | sed 's/"/\\"/g')
  RETIRED=$(echo "$PANEL_DATA" | cut -f3)

  if [ "$RETIRED" = "1" ]; then IS_ACTIVE="false"; else IS_ACTIVE="true"; fi

  PAYLOAD="{\"category\":\"create.lab.panel\",\"uuid\":\"$PUUID\",\"name\":\"$NAME\",\"is_active\":$IS_ACTIVE,\"product_category\":\"Panel\"}"

  if post_to_odoo "/api/bahmni-lab-panel" "$PAYLOAD"; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
  fi

  printf "\r  Lab Panels: %d synced, %d failed" "$SUCCESS" "$FAILED"
done

echo ""
echo -e "  ${GREEN}Lab Panels done: $SUCCESS synced, $FAILED failed${NOCOLOR}"
echo ""

# ── 5. Sync Radiology Tests ──────────────────────────────────────────────────

echo -e "${CYAN}=== Syncing Radiology Tests ===${NOCOLOR}"

RAD_UUIDS=$(mysql_query "
  SELECT DISTINCT c.uuid
  FROM concept c
  JOIN concept_class cc ON c.class_id = cc.concept_class_id
  WHERE cc.name = 'Radiology' AND c.retired = 0
  ORDER BY c.concept_id;
")
RAD_COUNT=$(echo "$RAD_UUIDS" | grep -c '[0-9]')
echo -e "  Found ${YELLOW}$RAD_COUNT${NOCOLOR} radiology tests"

SUCCESS=0
FAILED=0

for RUUID in $RAD_UUIDS; do
  RAD_DATA=$(mysql_query "
    SELECT
      c.uuid,
      cn.name,
      c.retired
    FROM concept c
    JOIN concept_name cn ON c.concept_id = cn.concept_id
      AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
    WHERE c.uuid = '$RUUID'
    LIMIT 1;
  ")

  if [ -z "$RAD_DATA" ]; then
    FAILED=$((FAILED + 1))
    continue
  fi

  NAME=$(echo "$RAD_DATA" | cut -f2 | sed 's/"/\\"/g')
  RETIRED=$(echo "$RAD_DATA" | cut -f3)

  if [ "$RETIRED" = "1" ]; then IS_ACTIVE="false"; else IS_ACTIVE="true"; fi

  PAYLOAD="{\"category\":\"create.radiology.test\",\"uuid\":\"$RUUID\",\"name\":\"$NAME\",\"is_active\":$IS_ACTIVE,\"product_category\":\"Radiology\"}"

  if post_to_odoo "/api/bahmni-radiology-test" "$PAYLOAD"; then
    SUCCESS=$((SUCCESS + 1))
  else
    FAILED=$((FAILED + 1))
  fi

  printf "\r  Radiology: %d synced, %d failed" "$SUCCESS" "$FAILED"
done

echo ""
echo -e "  ${GREEN}Radiology done: $SUCCESS synced, $FAILED failed${NOCOLOR}"
echo ""

echo -e "${CYAN}==== ALL SYNC COMPLETE ====${NOCOLOR}"
