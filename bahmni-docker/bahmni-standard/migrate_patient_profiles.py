#!/usr/bin/env python3
import subprocess
import sys

MYSQL_CMD = "docker exec -i bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' -sN openmrs"
STAGE_DB = "openmrs_legacy_stage"
LIVE_DB = "openmrs"

def run_sql(query):
    p = subprocess.Popen(MYSQL_CMD, shell=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out, err = p.communicate(input=query)
    if p.returncode != 0:
        print(f"[-] SQL Error: {err}", file=sys.stderr)
        sys.exit(1)
    return out.strip()

print("=======================================================")
print("[*] Starting Production Patient Profile Migration & Sync")
print("=======================================================")

# 1. Base ID offset and Staging check
chk_stage = run_sql(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '{STAGE_DB}' AND table_name = 'patient';")
if not chk_stage or int(chk_stage.split()[-1]) == 0:
    print(f"[!] Legacy staging database `{STAGE_DB}` does not exist or has not been loaded.", file=sys.stderr)
    print("[*] Please run '4. Interactive PDF Pipeline' first to stage the backup database.", file=sys.stderr)
    sys.exit(1)

# Clean up any orphaned person records before calculating offset
print("[*] Cleaning up orphaned person records in live database...")
run_sql(f"""
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM {LIVE_DB}.person_name WHERE person_id NOT IN (SELECT patient_id FROM {LIVE_DB}.patient) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.users) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.provider);
DELETE FROM {LIVE_DB}.person_address WHERE person_id NOT IN (SELECT patient_id FROM {LIVE_DB}.patient) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.users) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.provider);
DELETE FROM {LIVE_DB}.person_attribute WHERE person_id NOT IN (SELECT patient_id FROM {LIVE_DB}.patient) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.users) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.provider);
DELETE FROM {LIVE_DB}.person WHERE person_id NOT IN (SELECT patient_id FROM {LIVE_DB}.patient) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.users) AND person_id NOT IN (SELECT person_id FROM {LIVE_DB}.provider);
SET FOREIGN_KEY_CHECKS = 1;
""")

raw_offset = run_sql(f"SELECT COALESCE(MAX(person_id), 0) FROM {LIVE_DB}.person;")
offset = int(raw_offset.split()[-1]) if raw_offset else 0
print(f"[*] Base ID Offset: {offset}")

# 2. Build mapping table of unmigrated records
run_sql(f"""
DROP TABLE IF EXISTS {LIVE_DB}._legacy_patient_map;
CREATE TABLE {LIVE_DB}._legacy_patient_map AS
SELECT p.patient_id AS legacy_patient_id
FROM {STAGE_DB}.patient p
JOIN {STAGE_DB}.patient_identifier pi ON p.patient_id = pi.patient_id AND pi.voided = 0
LEFT JOIN {LIVE_DB}.patient_identifier lpi ON pi.identifier = lpi.identifier AND lpi.voided = 0
WHERE p.voided = 0 AND lpi.patient_id IS NULL
GROUP BY p.patient_id;
""")

pending_count = int(run_sql(f"SELECT COUNT(*) FROM {LIVE_DB}._legacy_patient_map;"))
print(f"[✔] Total unmigrated patients ready to insert: {pending_count}")

if pending_count > 0:
    # 3. Migrate PERSON
    print("[*] [1/6] Migrating Person records...")
    run_sql(f"""
    INSERT INTO {LIVE_DB}.person (person_id, gender, birthdate, birthdate_estimated, dead, death_date, cause_of_death, creator, date_created, voided, uuid)
    SELECT (m.legacy_patient_id + {offset}), p.gender, p.birthdate, p.birthdate_estimated, p.dead, p.death_date, p.cause_of_death, 1, COALESCE(p.date_created, NOW()), 0, UUID()
    FROM {LIVE_DB}._legacy_patient_map m
    JOIN {STAGE_DB}.person p ON m.legacy_patient_id = p.person_id;
    """)

    # 4. Migrate PATIENT
    print("[*] [2/6] Migrating Patient records...")
    run_sql(f"""
    INSERT INTO {LIVE_DB}.patient (patient_id, creator, date_created, voided)
    SELECT (m.legacy_patient_id + {offset}), 1, COALESCE(p.date_created, NOW()), 0
    FROM {LIVE_DB}._legacy_patient_map m
    JOIN {STAGE_DB}.patient p ON m.legacy_patient_id = p.patient_id;
    """)

    # 5. Migrate PERSON_NAME
    print("[*] [3/6] Migrating Person Name records...")
    run_sql(f"""
    INSERT INTO {LIVE_DB}.person_name (
        person_id, preferred, given_name, middle_name, family_name,
        prefix, family_name_prefix, family_name2, family_name_suffix, degree,
        creator, date_created, voided, uuid
    )
    SELECT 
        (m.legacy_patient_id + {offset}),
        pn.preferred,
        pn.given_name,
        pn.middle_name,
        pn.family_name,
        pn.prefix,
        pn.family_name_prefix,
        pn.family_name2,
        pn.family_name_suffix,
        pn.degree,
        1,
        COALESCE(pn.date_created, NOW()),
        0,
        UUID()
    FROM {LIVE_DB}._legacy_patient_map m
    JOIN {STAGE_DB}.person_name pn ON m.legacy_patient_id = pn.person_id AND pn.voided = 0;
    """)

    # 6. Migrate PATIENT_IDENTIFIER (Universal location_id = NULL)
    print("[*] [4/6] Migrating Patient Identifier records (Universal location_id = NULL)...")
    run_sql(f"""
    INSERT INTO {LIVE_DB}.patient_identifier (patient_id, identifier, identifier_type, preferred, location_id, creator, date_created, voided, uuid)
    SELECT (m.legacy_patient_id + {offset}), pi.identifier, 3, pi.preferred, NULL, 1, COALESCE(pi.date_created, NOW()), 0, UUID()
    FROM {LIVE_DB}._legacy_patient_map m
    JOIN {STAGE_DB}.patient_identifier pi ON m.legacy_patient_id = pi.patient_id AND pi.voided = 0;
    """)

    # 7. Migrate PERSON_ADDRESS
    print("[*] [5/6] Migrating Person Address records...")
    run_sql(f"""
    INSERT INTO {LIVE_DB}.person_address (
        person_id, preferred, state_province, county_district, city_village, address3, address2, address1,
        creator, date_created, voided, uuid
    )
    SELECT 
        (m.legacy_patient_id + {offset}),
        pa.preferred,
        COALESCE(pa.state_province, 'Amhara'),
        COALESCE(pa.county_district, pa.address1, 'South Wello'),
        pa.city_village,
        COALESCE(pa.address3, pa.city_village),
        COALESCE(pa.address2, pa.country),
        pa.address1,
        1,
        COALESCE(pa.date_created, NOW()),
        0,
        UUID()
    FROM {LIVE_DB}._legacy_patient_map m
    JOIN {STAGE_DB}.person_address pa ON m.legacy_patient_id = pa.person_id AND pa.voided = 0;
    """)

    # 8. Migrate PERSON_ATTRIBUTES
    print("[*] [6/6] Migrating Person Attributes...")
    # Standard attributes with concept re-mapping
    run_sql(f"""
    INSERT INTO {LIVE_DB}.person_attribute (person_id, value, person_attribute_type_id, creator, date_created, voided, uuid)
    SELECT 
        (m.legacy_patient_id + {offset}),
        CASE 
            WHEN src_pat.person_attribute_type_id = 29 AND pa.value = '7974' THEN '12121'
            WHEN src_pat.person_attribute_type_id = 29 AND pa.value = '7973' THEN '60762'
            WHEN src_pat.person_attribute_type_id = 29 AND pa.value = '7975' THEN '60764'
            ELSE pa.value
        END,
        CASE 
            WHEN LOWER(src_pat.name) IN ('phonenumber', 'telephonenumber', 'phone number') THEN 14
            WHEN LOWER(src_pat.name) IN ('alternatephonenumber', 'alternate phone number') THEN 15
            WHEN LOWER(src_pat.name) IN ('primary contact phone number') THEN 17
            WHEN LOWER(src_pat.name) IN ('primary contact person name') THEN 18
            WHEN LOWER(src_pat.name) IN ('referencenumber', 'reference number') THEN 27
            WHEN LOWER(src_pat.name) IN ('paymentmethod') THEN 29
            WHEN LOWER(src_pat.name) IN ('education') THEN 19
            WHEN LOWER(src_pat.name) IN ('credittype') THEN 23
            WHEN LOWER(src_pat.name) IN ('freepaymentdetails') THEN 24
            WHEN LOWER(src_pat.name) IN ('creditcompany') THEN 25
            WHEN LOWER(src_pat.name) IN ('cbhiagreedworeda') THEN 26
            WHEN LOWER(src_pat.name) IN ('medicolegalcases') THEN 28
            ELSE target_pat.person_attribute_type_id
        END,
        1,
        COALESCE(pa.date_created, NOW()),
        0,
        UUID()
    FROM {LIVE_DB}._legacy_patient_map m
    JOIN {STAGE_DB}.person_attribute pa ON m.legacy_patient_id = pa.person_id AND pa.voided = 0
    JOIN {STAGE_DB}.person_attribute_type src_pat ON pa.person_attribute_type_id = src_pat.person_attribute_type_id
    LEFT JOIN (
        SELECT LOWER(name) AS match_name, MIN(person_attribute_type_id) AS person_attribute_type_id
        FROM {LIVE_DB}.person_attribute_type
        WHERE retired = 0
        GROUP BY LOWER(name)
    ) target_pat ON LOWER(src_pat.name) = target_pat.match_name;
    """)

    # Also populate phoneNumber (type 14) from ReferenceNumber phone formats
    run_sql(f"""
    INSERT INTO {LIVE_DB}.person_attribute (person_id, value, person_attribute_type_id, creator, date_created, voided, uuid)
    SELECT 
        (m.legacy_patient_id + {offset}),
        pa.value,
        14,
        1,
        COALESCE(pa.date_created, NOW()),
        0,
        UUID()
    FROM {LIVE_DB}._legacy_patient_map m
    JOIN {STAGE_DB}.person_attribute pa ON m.legacy_patient_id = pa.person_id AND pa.voided = 0 AND pa.person_attribute_type_id = 27
    WHERE pa.value REGEXP '^[0\\\\+251][97][0-9]+$';
    """)

    run_sql(f"DROP TABLE IF EXISTS {LIVE_DB}._legacy_patient_map;")
else:
    print("[!] All patients already inserted. Running live synchronization & attribute repair...")

# 9. Live Database Repair and Synchronization (ensures existing profiles are 100% correct)
print("[*] Synchronizing and repairing address, payment concepts, and phone numbers in live database...")
run_sql(f"""
-- Address synchronization: ensure Woreda (address3), Zone (county_district), and Region (state_province)
UPDATE {LIVE_DB}.person_address SET address3 = city_village WHERE address3 IS NULL AND city_village IS NOT NULL;
UPDATE {LIVE_DB}.person_address SET county_district = 'South Wello' WHERE county_district IS NULL;
UPDATE {LIVE_DB}.person_address SET state_province = 'Amhara' WHERE state_province IS NULL;

-- Payment method concept harmonization: 7974 -> Cash (12121), 7973 -> Credit (60762), 7975 -> Free (60764)
UPDATE {LIVE_DB}.person_attribute SET value = '12121' WHERE person_attribute_type_id = 29 AND value = '7974';
UPDATE {LIVE_DB}.person_attribute SET value = '60762' WHERE person_attribute_type_id = 29 AND value = '7973';
UPDATE {LIVE_DB}.person_attribute SET value = '60764' WHERE person_attribute_type_id = 29 AND value = '7975';

-- Universal identifier configuration
UPDATE {LIVE_DB}.patient_identifier SET location_id = NULL WHERE voided = 0;

INSERT INTO {LIVE_DB}.global_property (property, property_value, uuid)
VALUES ('bahmni.primaryIdentifierType', 'd3153eb0-5e07-11ef-8f7c-0242ac120002', UUID())
ON DUPLICATE KEY UPDATE property_value = 'd3153eb0-5e07-11ef-8f7c-0242ac120002';

UPDATE {LIVE_DB}.metadatamapping_metadata_term_mapping mtm
JOIN {LIVE_DB}.metadatamapping_metadata_source mts ON mtm.metadata_source_id = mts.metadata_source_id
SET mtm.metadata_uuid = 'd3153eb0-5e07-11ef-8f7c-0242ac120002'
WHERE mtm.code IN ('emr.primaryIdentifierType', 'primaryIdentifierType');

UPDATE {LIVE_DB}.global_property SET property_value = '' WHERE property = 'patient.identifierPrefix';
UPDATE {LIVE_DB}.global_property SET property_value = '.*' WHERE property = 'patient.identifierRegex';
UPDATE {LIVE_DB}.global_property SET property_value = 'ANYWHERE' WHERE property = 'patientIdentifierSearch.matchMode';
UPDATE {LIVE_DB}.global_property SET property_value = '' WHERE property = 'patient.defaultPatientIdentifierValidator';
""")

print("=======================================================")
print("[✔] Migration & Universal MRN Configuration Completed!")
print("=======================================================")
