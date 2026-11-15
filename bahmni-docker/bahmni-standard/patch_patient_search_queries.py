#!/usr/bin/env python3
"""
Patch OpenMRS global properties for patient search queries:
- emrapi.sqlSearch.activePatientsByProvider (fixes missing attribute 29 / null city_village filtering out triage patients)
- emrapi.sqlsearch.triagequeue (fixes queue for triaged patients in registration)
- emrapi.sqlSearch.activeTriagedPatients (creates missing emergency / triaged patients tab query)
- emrapi.sqlSearch.LinkedPatients (ensures robust location matching)
"""

import subprocess
import sys

OPENMRS_DB = "bahmni-standard-openmrsdb-1"
MYSQL_USER = "root"
MYSQL_PASS = "adminAdmin!123"
MYSQL_DB = "openmrs"

def run_mysql(sql):
    cmd = [
        "docker", "exec", "-i", OPENMRS_DB,
        "mysql", f"-u{MYSQL_USER}", f"-p{MYSQL_PASS}", MYSQL_DB
    ]
    p = subprocess.Popen(
        cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE, text=True
    )
    stdout, stderr = p.communicate(input=sql)
    if p.returncode != 0:
        raise RuntimeError(f"MySQL error: {stderr.strip()}")
    return stdout.strip()

def apply_patches():
    print("[*] Applying permanent patient search patches to OpenMRS...")

    active_by_provider = """select distinct
  concat(pn.given_name,' ', ifnull(pn.middle_name,''),' ', ifnull(pn.family_name,'')) as name,
  pi.identifier as identifier,
  concat("",p.uuid) as uuid,
  concat("",v.uuid) as activeVisitUuid,
  IF(triaged_obs.value is not null, triaged_obs.value, "notAssigned") as triageColor
from visit v
join visit_type vt on v.visit_type_id = vt.visit_type_id
join person_name pn on v.patient_id = pn.person_id and pn.voided = 0
join patient_identifier pi on v.patient_id = pi.patient_id and pi.voided = 0
join patient_identifier_type pit on pi.identifier_type = pit.patient_identifier_type_id
join global_property gp on gp.property="bahmni.primaryIdentifierType" and gp.property_value=pit.uuid
join person p on p.person_id = v.patient_id and p.voided = 0
left join person_attribute pa on v.patient_id = pa.person_id and pa.person_attribute_type_id = 29 and pa.voided = 0
left join person_address pad on v.patient_id = pad.person_id and pad.voided = 0
join location l on l.uuid = ${location_uuid} and (
  v.location_id = l.location_id 
  or lower(trim(vt.name)) = lower(trim(l.name))
  or (lower(l.name) like '%triage%' and (lower(vt.name) like '%triage%' or v.location_id = l.location_id))
)
left join encounter en on en.visit_id = v.visit_id and en.voided = 0
left join (
  select o.encounter_id, coalesce(ans_cn.name, o.value_text) as value
  from obs o
  join concept_name cn on o.concept_id = cn.concept_id 
       and cn.name in ('Triage Code', 'Triage Category', 'Triage Color Result', 'Triage color') 
       and cn.voided = 0
  left join concept_name ans_cn on o.value_coded = ans_cn.concept_id 
       and ans_cn.voided = 0 
       and ans_cn.concept_name_type in ('SHORT', 'FULLY_SPECIFIED')
  where o.voided = 0
) triaged_obs on en.encounter_id = triaged_obs.encounter_id
where v.date_stopped is null AND v.voided = 0;"""

    triage_queue = """SELECT @row_number:=@row_number+1 AS `row_number`, t.* 
FROM (
    SELECT 
        pi.identifier, 
        TIME(v.date_created) as time, 
        1 as started, 
        COALESCE(
          (SELECT COALESCE(cn_ans.name, o.value_text)
           FROM obs o 
           JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.name IN ('Triage Code', 'Triage Category', 'Triage Color Result', 'Triage color') AND cn.voided = 0
           LEFT JOIN concept_name cn_ans ON o.value_coded = cn_ans.concept_id AND cn_ans.voided = 0 AND cn_ans.concept_name_type IN ('SHORT', 'FULLY_SPECIFIED')
           WHERE o.person_id = v.patient_id AND o.voided = 0 
           ORDER BY o.obs_datetime DESC LIMIT 1),
          'none'
        ) as emergency_color 
    FROM visit v 
    JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id 
    JOIN patient_identifier pi ON v.patient_id = pi.patient_id AND pi.voided = 0
    JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
    JOIN global_property gp ON gp.property = 'bahmni.primaryIdentifierType' AND gp.property_value = pit.uuid
    WHERE v.voided = 0 
      AND (
        v.date_stopped IS NULL 
        OR DATE(v.date_created) = CURDATE() 
        OR DATE(v.date_started) = CURDATE()
      )
      AND (
        LOWER(vt.name) LIKE '%triage%' 
        OR LOWER(vt.name) LIKE '%emergency%' 
        OR vt.name IN ('Central Triage', 'Central triage', 'Emergency OPD', 'Emergency Triage', 'ER')
      )
    GROUP BY pi.identifier 
    ORDER BY FIELD(emergency_color, "RED", "ORANGE", "YELLOW", "GREEN", "none"), v.date_created DESC
) as t, 
(SELECT @row_number := 0) rs;"""

    active_triaged = """select distinct
  concat(pn.given_name,' ', ifnull(pn.middle_name,''),' ', ifnull(pn.family_name,'')) as name,
  pi.identifier as identifier,
  concat("",p.uuid) as uuid,
  concat("",v.uuid) as activeVisitUuid,
  IF(triaged_obs.value is not null, triaged_obs.value, "notAssigned") as triageColor
from visit v
join visit_type vt on v.visit_type_id = vt.visit_type_id
join person_name pn on v.patient_id = pn.person_id and pn.voided = 0
join patient_identifier pi on v.patient_id = pi.patient_id and pi.voided = 0
join patient_identifier_type pit on pi.identifier_type = pit.patient_identifier_type_id
join global_property gp on gp.property="bahmni.primaryIdentifierType" and gp.property_value=pit.uuid
join person p on p.person_id = v.patient_id and p.voided = 0
left join person_attribute pa on v.patient_id = pa.person_id and pa.person_attribute_type_id = 29 and pa.voided = 0
left join person_address pad on v.patient_id = pad.person_id and pad.voided = 0
left join encounter en on en.visit_id = v.visit_id and en.voided = 0
left join (
  select o.encounter_id, coalesce(ans_cn.name, o.value_text) as value
  from obs o
  join concept_name cn on o.concept_id = cn.concept_id 
       and cn.name in ('Triage Code', 'Triage Category', 'Triage Color Result', 'Triage color') 
       and cn.voided = 0
  left join concept_name ans_cn on o.value_coded = ans_cn.concept_id 
       and ans_cn.voided = 0 
       and ans_cn.concept_name_type in ('SHORT', 'FULLY_SPECIFIED')
  where o.voided = 0
) triaged_obs on en.encounter_id = triaged_obs.encounter_id
where v.voided = 0
  and (
    (v.date_stopped is null and (lower(vt.name) like '%triage%' or lower(vt.name) like '%emergency%'))
    or (DATE(v.date_started) = CURDATE() and (lower(vt.name) like '%triage%' or lower(vt.name) like '%emergency%'))
  )
order by v.date_started desc;"""

    linked_patients = """select distinct
concat(pn.given_name,' ', ifnull(pn.middle_name,''),' ',
ifnull(pn.family_name,'')) as name,
pi.identifier as identifier,
concat("",p.uuid) as uuid,
concat("",v.uuid) as activeVisitUuid
from visit v
join visit_attribute va on v.visit_id = va.visit_id and attribute_type_id
=(
select visit_attribute_type_id from visit_attribute_type where
name="Linkage"
)
join visit_type vt on v.visit_type_id = vt.visit_type_id
join person_name pn on v.patient_id = pn.person_id and pn.voided = 0
join patient_identifier pi on v.patient_id = pi.patient_id and pi.voided = 0
join patient_identifier_type pit on pi.identifier_type =
pit.patient_identifier_type_id
join global_property gp on gp.property="bahmni.primaryIdentifierType" and
gp.property_value=pit.uuid
join person p on p.person_id = v.patient_id and p.voided = 0
join location l on l.uuid=${location_uuid} and (v.location_id = l.location_id or lower(trim(vt.name)) = lower(trim(l.name)))
where v.date_stopped is null AND v.voided = 0;"""

    queries = [
        ("emrapi.sqlSearch.activePatientsByProvider", active_by_provider),
        ("emrapi.sqlsearch.triagequeue", triage_queue),
        ("emrapi.sqlSearch.activeTriagedPatients", active_triaged),
        ("emrapi.sqlSearch.LinkedPatients", linked_patients),
    ]

    for prop_name, prop_val in queries:
        sql = f"""
        INSERT INTO global_property (property, property_value, uuid)
        VALUES ('{prop_name}', '{prop_val.replace("'", "''")}', UUID())
        ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);
        """
        run_mysql(sql)
        print(f"  [✔] Configured {prop_name}")

    print("[✔] OpenMRS patient search queries successfully patched!")

if __name__ == "__main__":
    apply_patches()
