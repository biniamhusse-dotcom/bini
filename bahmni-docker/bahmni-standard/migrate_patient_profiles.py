#!/usr/bin/env python3
import os
import re
import sys
import gzip
import argparse
import subprocess

OPENMRS_CONTAINER = "bahmni-standard-openmrsdb-1"
STAGE_DB = "openmrs_legacy_stage"
LIVE_DB = "openmrs"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DEFAULT_BACKUP_CANDIDATES = [
    "/opt/emr/backups/openmrs20261002_160501.sql.gz",
    "/home/hphc/Documents/Harbu bak/openmrs20261002_160501.sql.gz",
    "/opt/emr/CentOS Bahmni backups/openmrs20261002_160501.sql.gz",
    os.path.join(BASE_DIR, "..", "..", "CentOS Bahmni backups", "openmrs20261002_160501.sql.gz"),
    os.path.join(BASE_DIR, "..", "..", "backups", "openmrs20261002_160501.sql.gz"),
    os.path.join(BASE_DIR, "..", "..", "openmrs_backup_20260626_134854.sql"),
]


def run_sql(query, db=LIVE_DB):
    cmd = f"docker exec -i {OPENMRS_CONTAINER} mysql -uroot -p'adminAdmin!123' -sN {db}"
    p = subprocess.Popen(cmd, shell=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    out, err = p.communicate(input=query)
    if p.returncode != 0:
        print(f"[-] SQL Error: {err}", file=sys.stderr)
        sys.exit(1)
    return out.strip()


def ensure_staging_ready(backup_file=None):
    chk_stage = run_sql(f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '{STAGE_DB}' AND table_name = 'patient';")
    has_table = chk_stage and int(chk_stage.split()[-1]) > 0
    if has_table:
        pat_cnt = run_sql(f"SELECT COUNT(*) FROM {STAGE_DB}.patient;")
        if pat_cnt and pat_cnt.isdigit() and int(pat_cnt) > 0:
            print(f"[✔] Staging database `{STAGE_DB}` verified ready with {pat_cnt} patients.", flush=True)
            return

    archive_path = None
    if backup_file and os.path.exists(backup_file):
        archive_path = os.path.abspath(backup_file)
    else:
        for c in DEFAULT_BACKUP_CANDIDATES:
            if os.path.exists(c):
                archive_path = os.path.abspath(c)
                break

    if not archive_path or not os.path.exists(archive_path):
        print(f"[!] Legacy staging database `{STAGE_DB}` does not exist or has no patients.", file=sys.stderr, flush=True)
        print("[!] No backup archive found to restore. Please provide a CentOS backup file (.sql.gz / .sql).", file=sys.stderr, flush=True)
        sys.exit(1)

    print(f"[*] Staging {STAGE_DB} from backup archive: {archive_path}...", flush=True)
    run_sql(f"DROP DATABASE IF EXISTS {STAGE_DB}; CREATE DATABASE {STAGE_DB} CHARACTER SET utf8mb4;", db="mysql")

    opener = gzip.open if archive_path.endswith(".gz") else open
    cmd = [
        "docker", "exec", "-i", OPENMRS_CONTAINER,
        "mysql", "-uroot", "-padminAdmin!123", "--default-character-set=utf8mb4",
        "--force", STAGE_DB
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    with opener(archive_path, "rt", encoding="utf-8", errors="replace") as f_in:
        for line in f_in:
            if "DEFINER=" in line:
                line = re.sub(r'DEFINER=`[^`]+`@`[^`]+`', '', line)
            proc.stdin.write(line.encode("utf-8"))
    proc.stdin.close()
    proc.wait()
    print(f"[✔] Staging restoration completed from {archive_path}.", flush=True)


parser = argparse.ArgumentParser(description="Migrate Patient Profiles from CentOS backup/staging into OpenMRS")
parser.add_argument("--backup-file", "-b", help="Path to CentOS backup archive (.sql.gz or .sql)")
args, unknown = parser.parse_known_args()

backup_path = args.backup_file or os.environ.get("SPECIFIC_BACKUP")
if not backup_path and len(unknown) > 0 and not unknown[0].startswith("-"):
    backup_path = unknown[0]

print("=======================================================")
print("[*] Starting Production Patient Profile Migration & Sync")
print("=======================================================")

# 1. Base ID offset and Staging check/restoration
ensure_staging_ready(backup_path)

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

# 2. Build mapping table of unmigrated records (stripping any non-numeric prefix from identifiers)
run_sql(f"""
DROP TABLE IF EXISTS {LIVE_DB}._legacy_patient_map;
CREATE TABLE {LIVE_DB}._legacy_patient_map AS
SELECT p.patient_id AS legacy_patient_id
FROM {STAGE_DB}.patient p
JOIN {STAGE_DB}.patient_identifier pi ON p.patient_id = pi.patient_id AND pi.voided = 0
LEFT JOIN {LIVE_DB}.patient_identifier lpi ON 
    COALESCE(NULLIF(REGEXP_REPLACE(TRIM(pi.identifier), '^[^0-9]+', ''), ''), TRIM(pi.identifier)) = lpi.identifier 
    AND lpi.voided = 0
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

    # 6. Migrate PATIENT_IDENTIFIER (Universal location_id = NULL, pure numeric IDs only)
    print("[*] [4/6] Migrating Patient Identifier records (Universal location_id = NULL, pure numeric IDs)...")
    run_sql(f"""
    INSERT INTO {LIVE_DB}.patient_identifier (patient_id, identifier, identifier_type, preferred, location_id, creator, date_created, voided, uuid)
    SELECT (m.legacy_patient_id + {offset}), 
           COALESCE(NULLIF(REGEXP_REPLACE(TRIM(pi.identifier), '^[^0-9]+', ''), ''), TRIM(pi.identifier)),
           3, pi.preferred, NULL, 1, COALESCE(pi.date_created, NOW()), 0, UUID()
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
    SELECT person_id, value, attr_type, 1, date_created, 0, uuid
    FROM (
        SELECT
            (m.legacy_patient_id + {offset}) AS person_id,
            CASE
                WHEN src_pat.person_attribute_type_id = 29 AND pa.value = '7974' THEN '12121'
                WHEN src_pat.person_attribute_type_id = 29 AND pa.value = '7973' THEN '60762'
                WHEN src_pat.person_attribute_type_id = 29 AND pa.value = '7975' THEN '60764'
                ELSE pa.value
            END AS value,
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
            END AS attr_type,
            COALESCE(pa.date_created, NOW()) AS date_created,
            UUID() AS uuid
        FROM {LIVE_DB}._legacy_patient_map m
        JOIN {STAGE_DB}.person_attribute pa ON m.legacy_patient_id = pa.person_id AND pa.voided = 0
        JOIN {STAGE_DB}.person_attribute_type src_pat ON pa.person_attribute_type_id = src_pat.person_attribute_type_id
        LEFT JOIN (
            SELECT LOWER(name) AS match_name, MIN(person_attribute_type_id) AS person_attribute_type_id
            FROM {LIVE_DB}.person_attribute_type
            WHERE retired = 0
            GROUP BY LOWER(name)
        ) target_pat ON LOWER(src_pat.name) = target_pat.match_name
    ) mapped
    WHERE mapped.attr_type IS NOT NULL;
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
print("[*] Synchronizing and repairing address, payment concepts, identifiers, and auto-MRN in live database...")
run_sql(f"""
-- Address synchronization: ensure Woreda (address3), Zone (county_district), and Region (state_province)
UPDATE {LIVE_DB}.person_address SET address3 = city_village WHERE address3 IS NULL AND city_village IS NOT NULL;
UPDATE {LIVE_DB}.person_address SET county_district = 'South Wello' WHERE county_district IS NULL;
UPDATE {LIVE_DB}.person_address SET state_province = 'Amhara' WHERE state_province IS NULL;

-- Payment method concept harmonization: 7974 -> Cash (12121), 7973 -> Credit (60762), 7975 -> Free (60764)
UPDATE {LIVE_DB}.person_attribute SET value = '12121' WHERE person_attribute_type_id = 29 AND value = '7974';
UPDATE {LIVE_DB}.person_attribute SET value = '60762' WHERE person_attribute_type_id = 29 AND value = '7973';
UPDATE {LIVE_DB}.person_attribute SET value = '60764' WHERE person_attribute_type_id = 29 AND value = '7975';

-- Sanitize any existing identifiers in live DB that have non-numeric prefixes:
UPDATE {LIVE_DB}.patient_identifier 
SET identifier = REGEXP_REPLACE(TRIM(identifier), '^[^0-9]+', '') 
WHERE identifier REGEXP '^[^0-9]+';

-- Universal identifier configuration
UPDATE {LIVE_DB}.patient_identifier SET location_id = NULL WHERE voided = 0;

INSERT INTO {LIVE_DB}.global_property (property, property_value, uuid)
VALUES ('bahmni.primaryIdentifierType', 'd3153eb0-5e07-11ef-8f7c-0242ac120002', UUID())
ON DUPLICATE KEY UPDATE property_value = 'd3153eb0-5e07-11ef-8f7c-0242ac120002';

UPDATE {LIVE_DB}.metadatamapping_metadata_term_mapping mtm
JOIN {LIVE_DB}.metadatamapping_metadata_source mts ON mtm.metadata_source_id = mts.metadata_source_id
SET mtm.metadata_uuid = 'd3153eb0-5e07-11ef-8f7c-0242ac120002'
WHERE mtm.code IN ('emr.primaryIdentifierType', 'primaryIdentifierType');

-- Ensure Auto-MRN sequence generator has NO prefix and NO suffix (pure numbers)
UPDATE {LIVE_DB}.idgen_seq_id_gen SET prefix = NULL, suffix = NULL WHERE id = 1;
UPDATE {LIVE_DB}.idgen_identifier_source SET name = 'Patient Identifier', description = 'ID sequence source for patients' WHERE id = 1;

-- Synchronize Consultation Order Sets (All Orderables: Lab, Radiology, Pathology, Ophthalmology, Procedure)
INSERT INTO {LIVE_DB}.order_type_class_map (order_type_id, concept_class_id)
SELECT (SELECT order_type_id FROM {LIVE_DB}.order_type WHERE name = 'Pathology Order'),
       (SELECT concept_class_id FROM {LIVE_DB}.concept_class WHERE name = 'Pathology')
WHERE NOT EXISTS (
  SELECT 1 FROM {LIVE_DB}.order_type_class_map 
  WHERE order_type_id = (SELECT order_type_id FROM {LIVE_DB}.order_type WHERE name = 'Pathology Order')
    AND concept_class_id = (SELECT concept_class_id FROM {LIVE_DB}.concept_class WHERE name = 'Pathology')
);

DELETE FROM {LIVE_DB}.concept_set WHERE concept_set = 129;
INSERT INTO {LIVE_DB}.concept_set (concept_set, concept_id, sort_weight, creator, date_created, uuid)
VALUES
(129, 10, 0, 1, NOW(), '57e9760f-b987-4e20-a1e0-2dd971e912bb'),
(129, 67585, 1, 1, NOW(), '82a4dd2a-ce4e-4bcb-b326-a4672a806546'),
(129, 67418, 2, 1, NOW(), '91a46982-4a5e-47b4-a84a-e9066e84a3fa'),
(129, 67419, 3, 1, NOW(), 'eb70f0e4-f8f3-4464-a6f6-4cdb336e8021'),
(129, 57369, 4, 1, NOW(), '40a7936c-9104-4c37-82fe-cae513da9893');

UPDATE {LIVE_DB}.global_property SET property_value = NULL WHERE property = 'patient.identifierPrefix';
UPDATE {LIVE_DB}.global_property SET property_value = '.*' WHERE property = 'patient.identifierRegex';
UPDATE {LIVE_DB}.global_property SET property_value = 'ANYWHERE' WHERE property = 'patientIdentifierSearch.matchMode';
UPDATE {LIVE_DB}.global_property SET property_value = '' WHERE property = 'patient.defaultPatientIdentifierValidator';

INSERT INTO {LIVE_DB}.global_property (property, property_value, uuid)
VALUES ('emrapi.sqlSearch.activePatientsByProvider', 'select distinct
  concat(pn.given_name,'' '', ifnull(pn.middle_name,''''),'' '', ifnull(pn.family_name,'''')) as name,
  pi.identifier as identifier,
  concat(\"\",p.uuid) as uuid,
  concat(\"\",v.uuid) as activeVisitUuid,
  IF(triaged_obs.value is not null, triaged_obs.value, \"notAssigned\") as triageColor
from visit v
join visit_type vt on v.visit_type_id = vt.visit_type_id
join person_name pn on v.patient_id = pn.person_id and pn.voided = 0
join patient_identifier pi on v.patient_id = pi.patient_id and pi.voided = 0
join patient_identifier_type pit on pi.identifier_type = pit.patient_identifier_type_id
join global_property gp on gp.property=\"bahmni.primaryIdentifierType\" and gp.property_value=pit.uuid
join person p on p.person_id = v.patient_id and p.voided = 0
left join person_attribute pa on v.patient_id = pa.person_id and pa.person_attribute_type_id = 29 and pa.voided = 0
left join person_address pad on v.patient_id = pad.person_id and pad.voided = 0
join location l on l.uuid = ${{location_uuid}} and (
  v.location_id = l.location_id 
  or lower(trim(vt.name)) = lower(trim(l.name))
  or (lower(l.name) like ''%triage%'' and (lower(vt.name) like ''%triage%'' or v.location_id = l.location_id))
)
left join encounter en on en.visit_id = v.visit_id and en.voided = 0
left join (
  select o.encounter_id, coalesce(ans_cn.name, o.value_text) as value
  from obs o
  join concept_name cn on o.concept_id = cn.concept_id 
       and cn.name in (''Triage Code'', ''Triage Category'', ''Triage Color Result'', ''Triage color'') 
       and cn.voided = 0
  left join concept_name ans_cn on o.value_coded = ans_cn.concept_id 
       and ans_cn.voided = 0 
       and ans_cn.concept_name_type in (''SHORT'', ''FULLY_SPECIFIED'')
  where o.voided = 0
) triaged_obs on en.encounter_id = triaged_obs.encounter_id
where v.date_stopped is null AND v.voided = 0;', UUID())
ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

INSERT INTO {LIVE_DB}.global_property (property, property_value, uuid)
VALUES ('emrapi.sqlsearch.triagequeue', 'SELECT @row_number:=@row_number+1 AS `row_number`, t.* 
FROM (
    SELECT 
        pi.identifier, 
        TIME(v.date_created) as time, 
        1 as started, 
        COALESCE(
          (SELECT COALESCE(cn_ans.name, o.value_text)
           FROM obs o 
           JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.name IN (''Triage Code'', ''Triage Category'', ''Triage Color Result'', ''Triage color'') AND cn.voided = 0
           LEFT JOIN concept_name cn_ans ON o.value_coded = cn_ans.concept_id AND cn_ans.voided = 0 AND cn_ans.concept_name_type IN (''SHORT'', ''FULLY_SPECIFIED'')
           WHERE o.person_id = v.patient_id AND o.voided = 0 
           ORDER BY o.obs_datetime DESC LIMIT 1),
          ''none''
        ) as emergency_color 
    FROM visit v 
    JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id 
    JOIN patient_identifier pi ON v.patient_id = pi.patient_id AND pi.voided = 0
    JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
    JOIN global_property gp ON gp.property = ''bahmni.primaryIdentifierType'' AND gp.property_value = pit.uuid
    WHERE v.voided = 0 
      AND (
        v.date_stopped IS NULL 
        OR DATE(v.date_created) = CURDATE() 
        OR DATE(v.date_started) = CURDATE()
      )
      AND (
        LOWER(vt.name) LIKE ''%triage%'' 
        OR LOWER(vt.name) LIKE ''%emergency%'' 
        OR vt.name IN (''Central Triage'', ''Central triage'', ''Emergency OPD'', ''Emergency Triage'', ''ER'')
      )
    GROUP BY pi.identifier 
    ORDER BY FIELD(emergency_color, \"RED\", \"ORANGE\", \"YELLOW\", \"GREEN\", \"none\"), v.date_created DESC
) as t, 
(SELECT @row_number := 0) rs;', UUID())
ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

INSERT INTO {LIVE_DB}.global_property (property, property_value, uuid)
VALUES ('emrapi.sqlSearch.activeTriagedPatients', 'select distinct
  concat(pn.given_name,'' '', ifnull(pn.middle_name,''''),'' '', ifnull(pn.family_name,'''')) as name,
  pi.identifier as identifier,
  concat(\"\",p.uuid) as uuid,
  concat(\"\",v.uuid) as activeVisitUuid,
  IF(triaged_obs.value is not null, triaged_obs.value, \"notAssigned\") as triageColor
from visit v
join visit_type vt on v.visit_type_id = vt.visit_type_id
join person_name pn on v.patient_id = pn.person_id and pn.voided = 0
join patient_identifier pi on v.patient_id = pi.patient_id and pi.voided = 0
join patient_identifier_type pit on pi.identifier_type = pit.patient_identifier_type_id
join global_property gp on gp.property=\"bahmni.primaryIdentifierType\" and gp.property_value=pit.uuid
join person p on p.person_id = v.patient_id and p.voided = 0
left join person_attribute pa on v.patient_id = pa.person_id and pa.person_attribute_type_id = 29 and pa.voided = 0
left join person_address pad on v.patient_id = pad.person_id and pad.voided = 0
left join encounter en on en.visit_id = v.visit_id and en.voided = 0
left join (
  select o.encounter_id, coalesce(ans_cn.name, o.value_text) as value
  from obs o
  join concept_name cn on o.concept_id = cn.concept_id 
       and cn.name in (''Triage Code'', ''Triage Category'', ''Triage Color Result'', ''Triage color'') 
       and cn.voided = 0
  left join concept_name ans_cn on o.value_coded = ans_cn.concept_id 
       and ans_cn.voided = 0 
       and ans_cn.concept_name_type in (''SHORT'', ''FULLY_SPECIFIED'')
  where o.voided = 0
) triaged_obs on en.encounter_id = triaged_obs.encounter_id
where v.voided = 0
  and (
    (v.date_stopped is null and (lower(vt.name) like ''%triage%'' or lower(vt.name) like ''%emergency%''))
    or (DATE(v.date_started) = CURDATE() and (lower(vt.name) like ''%triage%'' or lower(vt.name) like ''%emergency%''))
  )
order by v.date_started desc;', UUID())
ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);
""")

print("=======================================================")
print("[✔] Migration & Universal MRN Configuration Completed!")
print("=======================================================")
