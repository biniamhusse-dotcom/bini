#!/bin/bash
# ============================================================
# Dagu Sponsor & Mapping Fix Script
# Run this against the Dagu PostgreSQL database (eapts_dev)
# Usage: psql -h localhost -U postgres -d eapts_dev -f dagu-sponsor-fix.sh
# Or:    bash dagu-sponsor-fix.sh
# ============================================================

set -e

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-eapts_dev}"
PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-6h5Q4W4gPC}"

PSQL="psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -v ON_ERROR_STOP=1"

echo "============================================"
echo "  Dagu Sponsor & Mapping Fix"
echo "  Target: $PGDATABASE @ $PGHOST:$PGPORT"
echo "============================================"

# --------------------------------------------------
# 1. Fix all sponsors woreda_id = 5024 (Dire Dawa)
#    Ensures GetSponsorByWoreda returns all sponsors
#    for any institution (all use woreda_id 5024)
# --------------------------------------------------
echo ""
echo "[1/3] Setting all sponsors woreda_id = 5024 ..."
$PSQL <<'SQL'
UPDATE du.sponsor SET woreda_id = 5024 WHERE woreda_id IS DISTINCT FROM 5024;
SQL
echo "  Done. Verifying:"
$PSQL -c "SELECT id, name, woreda_id FROM du.sponsor ORDER BY id;"

# --------------------------------------------------
# 2. Set OPD Pharmacy woreda_id = 5024 (Dire Dawa)
#    All institutions must share the same woreda_id
# --------------------------------------------------
echo ""
echo "[2/3] Setting OPD Pharmacy (12290) woreda_id = 5024 ..."
$PSQL <<'SQL'
UPDATE institution.institution SET woreda_id = 5024 WHERE id = 12290;
SQL
echo "  Done. Verifying all institutions:"
$PSQL -c "SELECT id, name, woreda_id FROM institution.institution WHERE id IN (3101,12287,12290,12291,12293,2880670,2880671,2880672) ORDER BY id;"

# --------------------------------------------------
# 3. Populate sponsor_mapping (OpenMRS -> Dagu)
#    Maps all OpenMRS CreditCompany concept UUIDs
#    to Dagu sponsor IDs (currently all NULL)
# --------------------------------------------------
echo ""
echo "[3/3] Populating common.sponsor_mapping ..."
$PSQL <<'SQL'
DELETE FROM common.sponsor_mapping;

-- N/A concept -> NULL sponsor
INSERT INTO common.sponsor_mapping (openmrs_concept_uuid, dagu_sponsor_id, description)
VALUES ('fd08aa37-e18d-415d-be41-f8bbbc81bea3', NULL, 'N/A - No sponsor');

-- All CreditCompany employer/organization concepts -> NULL sponsor
-- (No direct 1:1 match with Dagu sponsors; pharmacy staff selects manually)
INSERT INTO common.sponsor_mapping (openmrs_concept_uuid, dagu_sponsor_id, description) VALUES
('482a0e3e-c7f2-4605-9ced-05e56ef7dcd1', NULL, 'Carvico Ethiopia PLC'),
('1f44c7b5-811a-4d4d-8d95-7bf8cd8d55ae', NULL, 'Cosp'),
('61e00fb8-c2aa-4e2b-8d1a-469b10361e12', NULL, 'Country Ministry Of Defense level 3 Million Hospital'),
('fb876e0f-faa9-4e7d-91b6-1a00b2c4f023', NULL, 'Dessie Sport'),
('1a5c18af-9c26-4f69-ab3e-d6d1f578ad24', NULL, 'Dessie Town Police'),
('edbba056-b9a6-4d09-a605-c7593d027299', NULL, 'Dessie zuria Police'),
('ba81520f-998a-4231-baf1-1d5539f89d5d', NULL, 'Desssie Health Science college'),
('1694a711-4b7c-426f-8d71-0a597efdbd65', NULL, 'Electric Power'),
('092d9fe8-485c-44fc-9aa3-2bc9938d7bee', NULL, 'Electric Service'),
('e869efb1-8f8c-4056-a2c7-45b45aa1e8d4', NULL, 'Federal Police'),
('0f27c254-bb12-4c45-85d5-ecd34747640a', NULL, 'Forest Enterprise Kombolcha'),
('3f373c10-cfd2-47e8-b018-bd173948f2a2', NULL, 'Goshemeda Banba And Plastic'),
('176c78cb-c1d4-4661-9eb9-9f797754ce53', NULL, 'Grad 12 student the Challenge'),
('931e01fa-6147-4832-a159-a4f31b260f89', NULL, 'Insurance Organization'),
('81eec671-432a-4fe3-825d-2a5c4ffee67e', NULL, 'Kombolcha Textile Share Company'),
('f95b56cb-e7d3-45b3-b460-0239efbcb6ca', NULL, 'kombolcha Town Wate And Seaer'),
('ddf77872-8fc5-4b54-b813-e802806b074d', NULL, 'Lucy Hotal'),
('50cb3121-07d1-406e-ba89-7db02ae9cab7', NULL, 'Marema bate Abale'),
('a3d8465a-8d6c-4bda-9e20-e598badbc88b', NULL, 'Marema bate Tarami'),
('45cfc65e-52c4-44ff-ad0b-e201ab4c26bd', NULL, 'Mekdela Amba University'),
('c9175174-40fe-4693-9862-768a5b5ee46a', NULL, 'MJAA'),
('8faf99ae-553b-4ed0-bbd7-b8b6dbc60a3e', NULL, 'Moha Soft Drinks'),
('6f450248-b127-46aa-9c23-1e4e009dfb52', NULL, 'MSFB'),
('562e67ca-661b-48e8-ba7b-d5ad76f914de', NULL, 'MTI'),
('17949775-d106-470c-af6e-33d40907c2a8', NULL, 'Plan International Ethiopia'),
('67675bd8-692c-4f99-a871-be8a7678ab77', NULL, 'Reach'),
('99da8d31-6a8f-4fde-b57d-c8e01a6c4672', NULL, 'Samara University'),
('5bcd67db-c662-4447-9dc7-4b73213ff310', NULL, 'Tersest'),
('7e37a912-8da5-4560-a573-731d508ed273', NULL, 'Whole Gosple Believers'),
('d7abe56a-c05c-48a9-91bc-3e7cff0dc624', NULL, 'Wolo University Dessie Campos'),
('f6ea74c6-27f9-465f-9f7e-61291f7aa871', NULL, 'Wolo University Kombolcha Campas'),
('c896ae77-631c-4e2f-8c72-4588b52157ff', NULL, 'Zone Police');
SQL
echo "  Done. Verifying:"
$PSQL -c "SELECT count(*) as total_mappings FROM common.sponsor_mapping;"
$PSQL -c "SELECT id, openmrs_concept_uuid, dagu_sponsor_id, description FROM common.sponsor_mapping ORDER BY id;"

echo ""
echo "============================================"
echo "  All fixes applied successfully!"
echo "============================================"
