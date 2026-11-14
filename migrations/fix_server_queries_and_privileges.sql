-- =========================================================================
-- Comprehensive OpenMRS Server Hotfixes, Named Queries & Admin Privileges
-- =========================================================================

-- 1. Ensure fallback concept UUID exists as N/A
INSERT IGNORE INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
VALUES (0, 3, 11, 0, 1, NOW(), 'fd08aa37-e18d-415d-be41-f8bbbc81bea3');

SET @fallback_cid = (SELECT concept_id FROM concept WHERE uuid = 'fd08aa37-e18d-415d-be41-f8bbbc81bea3' LIMIT 1);

INSERT IGNORE INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @fallback_cid, 'N/A', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @fallback_cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM concept_name WHERE concept_id = @fallback_cid);

-- Ensure required person records for standard and active providers exist
INSERT IGNORE INTO person (person_id, gender, creator, date_created, voided, uuid) VALUES
(6, 'U', 1, NOW(), 0, 'f9ba912a-ab76-11e2-9e96-0800200c9a66'),
(1120320, 'M', 1, NOW(), 0, UUID()),
(1120340, 'M', 1, NOW(), 0, UUID()),
(1276545, 'M', 1, NOW(), 0, UUID()),
(1276556, 'M', 1, NOW(), 0, UUID());

INSERT IGNORE INTO person_name (person_id, given_name, family_name, preferred, creator, date_created, voided, uuid) VALUES
(6, 'Unknown', 'Provider', 1, 1, NOW(), 0, UUID()),
(1120320, 'Metages', '', 1, 1, NOW(), 0, UUID()),
(1120340, 'Frezer', '', 1, 1, NOW(), 0, UUID()),
(1276545, 'Test', '', 1, 1, NOW(), 0, UUID()),
(1276556, 'Test2', '', 1, 1, NOW(), 0, UUID());

UPDATE provider SET person_id = 6 WHERE provider_id = 4;
UPDATE provider SET person_id = 1120320 WHERE provider_id = 2114;
UPDATE provider SET person_id = 1120340 WHERE provider_id = 2115;
UPDATE provider SET person_id = 1276545 WHERE provider_id = 2164;
UPDATE provider SET person_id = 1276556 WHERE provider_id = 2165;

-- 2. Audit log resiliency
UPDATE audit_log al 
LEFT JOIN patient p ON al.patient_id = p.patient_id 
SET al.patient_id = NULL 
WHERE al.patient_id IS NOT NULL AND p.patient_id IS NULL;

UPDATE audit_log SET message = 'AUDIT_LOG_ENTRY' WHERE message IS NULL;

-- 3. Register Admin Privileges into privilege table
INSERT IGNORE INTO privilege (privilege, description, uuid) VALUES
('app:admin', 'Bahmni admin app access privilege', UUID()),
('app:admin:backupRestore', 'Bahmni Admin: Access Backup & Restore App', UUID()),
('app:admin:branding', 'Bahmni Admin: Access Branding Configuration App', UUID()),
('app:admin:dashboardConfig', 'Bahmni Admin: Access Dashboard & Forms Config App', UUID()),
('app:admin:deleteBackup', 'Bahmni Admin: Privilege to delete backup archives', UUID()),
('app:admin:diagnosisManagement', 'Bahmni Admin: Access Diagnosis & ICD-11 Management App', UUID()),
('app:admin:drugManagement', 'Bahmni Admin: Access Drug & Supply Management App', UUID()),
('app:admin:erTriageConfig', 'Bahmni Admin: Access ER Triage Config App', UUID()),
('app:admin:locationVisitMapping', 'Bahmni Admin: Access Location & Visit Mapping App', UUID()),
('app:admin:obsFormManager', 'Bahmni Admin: Access Observation Form Builder App', UUID()),
('app:admin:paymentConfig', 'Bahmni Admin: Access Payment Config App', UUID()),
('app:admin:restore', 'Bahmni Admin: Privilege to restore system backups and access restore operations', UUID());

-- 4. Grant all admin privileges to all administrative roles
INSERT IGNORE INTO role_privilege (role, privilege)
SELECT r.role, p.privilege
FROM role r
CROSS JOIN privilege p
WHERE r.role IN ('SuperAdmin', 'System Developer', 'Super User', 'Admin-App', 'Privilege Level: Full', 'Privilege Level: High', 'Doctor')
  AND p.privilege LIKE 'app:admin%';

-- 5. Named SQL Query: emr.prescription.listAll
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emr.prescription.listAll',
  'SELECT pt.person_id AS patient_id, pt.uuid AS patient_uuid, COALESCE(pi.identifier, '''') AS patient_identifier, ptn.given_name AS first_name, ptn.middle_name AS father_name, ptn.family_name AS grandfather_name, pt.gender AS gender, TIMESTAMPDIFF(YEAR, pt.birthdate, CURDATE()) AS age, COALESCE(phone_attr.value, '''') AS phone_number, o.order_id AS order_id, o.uuid AS order_uuid, enc.uuid AS encounter_uuid, o.date_activated AS prescription_date, d.drug_id AS drug_id, d.name AS drug_name, doord.dose AS dose, COALESCE(dose_unit_cn.name, '''') AS dose_units, COALESCE(freq_cn.name, '''') AS frequency, doord.duration AS duration, COALESCE(dur_unit_cn.name, '''') AS duration_units, doord.quantity AS quantity, COALESCE(quant_unit_cn.name, '''') AS quantity_units, COALESCE(route_cn.name, '''') AS route_name, COALESCE(doord.dosing_instructions, '''') AS instructions, CONCAT(pn.given_name, '' '', pn.family_name) AS provider_name, CASE WHEN EXISTS ( SELECT 1 FROM obs res WHERE res.person_id = pt.person_id AND res.concept_id = (SELECT concept_id FROM concept WHERE uuid = ''07d93800-d822-4229-996c-2fd05091563e'') AND res.voided = 0 AND res.value_text LIKE CONCAT(''[DTP_HISTORY]%'', o.uuid, ''%'') ) THEN ''ISSUED'' WHEN (SELECT ob.value_text FROM obs ob INNER JOIN concept c ON ob.concept_id = c.concept_id WHERE ob.order_id = o.order_id AND ob.voided = 0 AND c.uuid = ''97a9b0ad-ca27-44bb-96c8-fc0502ce09e6'' ORDER BY ob.obs_datetime DESC, ob.obs_id DESC LIMIT 1) IS NOT NULL THEN (SELECT ob.value_text FROM obs ob INNER JOIN concept c ON ob.concept_id = c.concept_id WHERE ob.order_id = o.order_id AND ob.voided = 0 AND c.uuid = ''97a9b0ad-ca27-44bb-96c8-fc0502ce09e6'' ORDER BY ob.obs_datetime DESC, ob.obs_id DESC LIMIT 1) WHEN EXISTS ( SELECT 1 FROM obs ob INNER JOIN concept c ON ob.concept_id = c.concept_id WHERE ob.order_id = o.order_id AND ob.voided = 0 AND c.uuid = ''07d93800-d822-4229-996c-2fd05091563e'' ) THEN ''RETURNED_DTP'' ELSE ''ISSUED'' END AS rx_status FROM orders o INNER JOIN drug_order doord ON o.order_id = doord.order_id INNER JOIN drug d ON doord.drug_inventory_id = d.drug_id INNER JOIN encounter enc ON o.encounter_id = enc.encounter_id INNER JOIN person pt ON o.patient_id = pt.person_id INNER JOIN patient pat ON pt.person_id = pat.patient_id INNER JOIN person_name ptn ON pt.person_id = ptn.person_id AND ptn.preferred = 1 LEFT JOIN patient_identifier pi ON pat.patient_id = pi.patient_id AND pi.preferred = 1 LEFT JOIN person_attribute phone_attr ON pt.person_id = phone_attr.person_id AND phone_attr.person_attribute_type_id = 14 LEFT JOIN encounter_provider ep ON enc.encounter_id = ep.encounter_id LEFT JOIN provider prov ON ep.provider_id = prov.provider_id LEFT JOIN person_name pn ON prov.person_id = pn.person_id LEFT JOIN concept_name route_cn ON route_cn.concept_id = doord.route AND route_cn.concept_name_type = ''FULLY_SPECIFIED'' AND route_cn.voided = 0 AND route_cn.locale = ''en'' LEFT JOIN concept_name dose_unit_cn ON dose_unit_cn.concept_id = doord.dose_units AND dose_unit_cn.concept_name_type = ''FULLY_SPECIFIED'' AND dose_unit_cn.voided = 0 AND dose_unit_cn.locale = ''en'' LEFT JOIN concept_name dur_unit_cn ON dur_unit_cn.concept_id = doord.duration_units AND dur_unit_cn.concept_name_type = ''FULLY_SPECIFIED'' AND dur_unit_cn.voided = 0 AND dur_unit_cn.locale = ''en'' LEFT JOIN concept_name quant_unit_cn ON quant_unit_cn.concept_id = doord.quantity_units AND quant_unit_cn.concept_name_type = ''FULLY_SPECIFIED'' AND quant_unit_cn.voided = 0 AND quant_unit_cn.locale = ''en'' LEFT JOIN order_frequency ord_freq ON ord_freq.order_frequency_id = doord.frequency LEFT JOIN concept_name freq_cn ON freq_cn.concept_id = ord_freq.concept_id AND freq_cn.concept_name_type = ''FULLY_SPECIFIED'' AND freq_cn.voided = 0 AND freq_cn.locale = ''en'' WHERE o.order_type_id = 2 AND o.voided = 0 AND o.order_action != ''DISCONTINUE'' AND o.date_activated IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders o_next WHERE o_next.previous_order_id = o.order_id AND o_next.voided = 0) ORDER BY o.date_activated DESC',
  'Query to list all prescribed patients with prescription details and DTP status',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 6. Named SQL Query: emrapi.sqlSearch.referralManagement
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emrapi.sqlSearch.referralManagement',
  'SELECT
    TRIM(CONCAT(pn.given_name, IF(pn.middle_name IS NOT NULL AND pn.middle_name != '''', CONCAT('' '', pn.middle_name), ''''), IF(pn.family_name IS NOT NULL AND pn.family_name != '''', CONCAT('' '', pn.family_name), ''''))) AS name,
    pi.identifier AS identifier,
    concat('''', p.uuid) AS patientUuid,
    concat('''', v.uuid) AS visitUuid,
    TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) AS age,
    IF(p.gender = ''M'', ''Male'', IF(p.gender = ''F'', ''Female'', ''Other'')) AS sex,
    IFNULL(pa.state_province, '''') AS region,
    IFNULL(pa.county_district, '''') AS subcity,
    IFNULL(pa.city_village, '''') AS woreda,
    IFNULL(pa.address2, '''') AS kebele,
    v.date_created AS referDate,
    v.date_stopped AS closedDate,
    IF(v.date_stopped IS NULL, ''Open'', ''Closed'') AS status,
    IFNULL(MAX(CASE WHEN rcn.name = ''Refers'' THEN ro.value_text END), '''') AS referredTo,
    IFNULL(MAX(CASE WHEN rcn.name = ''Referral department'' THEN ro.value_text END), '''') AS department,
    IFNULL(MAX(CASE WHEN rcn.name = ''Non-coded Diagnosis'' THEN ro.value_text END), '''') AS diagnosis,
    IFNULL(MAX(CASE WHEN rcn.name = ''Patient condition at referral'' THEN ro.value_text END), '''') AS patientCondition,
    IFNULL(MAX(CASE WHEN rcn.name = ''Reason for referral (text)'' THEN ro.value_text END), '''') AS reasonForReferral,
    IFNULL(MAX(CASE WHEN rcn.name = ''Need ambulance'' THEN ro.value_text END), '''') AS needAmbulance,
    IFNULL(MAX(CASE WHEN rcn.name = ''Need escorting professionals'' THEN ro.value_text END), '''') AS needEscorting,
    ''Out'' AS referralDirection,
    IFNULL(MAX(eloc.name), '''') AS location,
    COALESCE(
        NULLIF(TRIM(MAX(CONCAT(cu_pn.given_name, IF(cu_pn.middle_name IS NOT NULL AND cu_pn.middle_name != '''', CONCAT('' '', cu_pn.middle_name), ''''), IF(cu_pn.family_name IS NOT NULL AND cu_pn.family_name != '''', CONCAT('' '', cu_pn.family_name), '''')))), ''''),
        NULLIF(TRIM(MAX(CONCAT(prv_pn.given_name, IF(prv_pn.middle_name IS NOT NULL AND prv_pn.middle_name != '''', CONCAT('' '', prv_pn.middle_name), ''''), IF(prv_pn.family_name IS NOT NULL AND prv_pn.family_name != '''', CONCAT('' '', prv_pn.family_name), '''')))), ''''),
        MAX(cu.username),
        ''''
    ) AS physicianName,
    IFNULL(MAX(CASE WHEN rcn.name = ''Referral Approved By'' THEN ro.value_text END), '''') AS approvedBy,
    IFNULL(MAX(CASE WHEN rcn.name = ''Referral Senior Physician Specialty'' THEN ro.value_text END), '''') AS approvedSpecialty,
    IFNULL(MAX(CASE WHEN rcn.name = ''Referral Approval Method'' THEN ro.value_text END), '''') AS approvalMethod,
    IFNULL(MAX(CASE WHEN rcn.name = ''Referral Approval DateTime'' THEN ro.value_text END), '''') AS approvalDateTime,
    IFNULL(MAX(CASE WHEN rcn.name = ''Referral Approval Notes'' THEN ro.value_text END), '''') AS approvalNotes
FROM (
    SELECT DISTINCT disp_o.encounter_id
    FROM obs disp_o
    INNER JOIN concept_name disp_cn ON disp_o.value_coded = disp_cn.concept_id 
        AND disp_cn.name = ''Refer Patient'' 
        AND disp_cn.concept_name_type = ''FULLY_SPECIFIED'' 
        AND disp_cn.voided = 0
    WHERE disp_o.voided = 0
) ref_enc
INNER JOIN encounter e ON ref_enc.encounter_id = e.encounter_id AND e.voided = 0
INNER JOIN visit v ON e.visit_id = v.visit_id AND v.voided = 0
INNER JOIN person p ON v.patient_id = p.person_id AND p.voided = 0
INNER JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0
INNER JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided = 0
INNER JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
INNER JOIN global_property gp ON gp.property = ''bahmni.primaryIdentifierType'' AND gp.property_value = pit.uuid
LEFT JOIN person_address pa ON p.person_id = pa.person_id AND pa.voided = 0 AND pa.preferred = 1
INNER JOIN location loc ON v.location_id = loc.location_id
LEFT JOIN location eloc ON e.location_id = eloc.location_id
LEFT JOIN users cu ON e.creator = cu.user_id
LEFT JOIN person_name cu_pn ON cu.person_id = cu_pn.person_id AND cu_pn.voided = 0
LEFT JOIN encounter_provider ep ON e.encounter_id = ep.encounter_id AND ep.voided = 0
LEFT JOIN provider prv ON ep.provider_id = prv.provider_id
LEFT JOIN person_name prv_pn ON prv.person_id = prv_pn.person_id AND prv_pn.voided = 0
LEFT JOIN obs ro ON e.encounter_id = ro.encounter_id AND ro.voided = 0
LEFT JOIN concept_name rcn ON ro.concept_id = rcn.concept_id 
    AND rcn.name IN (
        ''Refers'', ''Referral department'', ''Non-coded Diagnosis'', 
        ''Patient condition at referral'', ''Reason for referral (text)'', 
        ''Need ambulance'', ''Need escorting professionals'', 
        ''Referral Approved By'', ''Referral Senior Physician Specialty'', 
        ''Referral Approval Method'', ''Referral Approval DateTime'', 
        ''Referral Approval Notes''
    )
    AND rcn.concept_name_type = ''FULLY_SPECIFIED'' 
    AND rcn.voided = 0
GROUP BY v.visit_id, e.encounter_id, pn.given_name, pn.middle_name, pn.family_name, 
         pi.identifier, p.birthdate, p.gender, pa.state_province, pa.county_district, 
         pa.city_village, pa.address2, p.uuid, v.uuid, v.date_created, v.date_stopped, loc.uuid
ORDER BY v.date_created DESC',
  'Bed Management: Referral In/Out Register Management',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 7. Named SQL Query: emrapi.sqlSearch.admissionRegister
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emrapi.sqlSearch.admissionRegister',
  'SELECT 
    v.visit_id,
    p.uuid as patient_uuid,
    v.uuid as visit_uuid,
    pi.identifier as mrn,
    TRIM(CONCAT(pn.given_name, IF(pn.middle_name IS NOT NULL AND pn.middle_name != '''', CONCAT('' '', pn.middle_name), ''''), IF(pn.family_name IS NOT NULL AND pn.family_name != '''', CONCAT('' '', pn.family_name), ''''))) as patient_name,
    p.gender as sex,
    TIMESTAMPDIFF(YEAR, p.birthdate, v.date_started) as age,
    COALESCE(pa.city_village, pa.address1, '''') as woreda,
    COALESCE(pa.address2, pa.county_district, '''') as subcity,
    DATE_FORMAT(v.date_started, ''%Y-%m-%d %H:%i:%s'') as admission_date,
    DATE_FORMAT(v.date_stopped, ''%Y-%m-%d %H:%i:%s'') as discharge_date,
    IF(v.date_stopped IS NULL, ''Admitted'', ''Discharged'') as status,
    DATEDIFF(IFNULL(v.date_stopped, NOW()), v.date_started) as length_of_stay,
    COALESCE(MAX(CASE WHEN el.name LIKE ''%Ward%'' OR el.name LIKE ''%ICU%'' THEN el.name END), vt.name, ''IPD'') as ward_name,
    ''-'' as bed_number,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN COALESCE(cn.name, o.value_text) END SEPARATOR ''; ''), ''-'') as admission_diagnosis,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN crt.code END SEPARATOR ''; ''), ''-'') as icd11_code,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN COALESCE(cn.name, o.value_text) END SEPARATOR ''; ''), ''-'') as discharge_diagnosis,
    COALESCE(MAX(CASE WHEN o.concept_id IN (3325, 11924) THEN COALESCE(val_cn.name, o.value_text) END), '''') as road_traffic_accident,
    COALESCE(MAX(CASE WHEN o.concept_id = 63657 THEN IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text) END), '''') as hiv_offered,
    COALESCE(MAX(CASE WHEN o.concept_id IN (22442, 63658) THEN IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text) END), '''') as hiv_performed,
    COALESCE(MAX(CASE WHEN o.concept_id = 63659 THEN COALESCE(val_cn.name, o.value_text) END), '''') as hiv_target_category,
    COALESCE(MAX(CASE WHEN o.concept_id IN (32992, 47297) THEN COALESCE(val_cn.name, o.value_text) END), '''') as hiv_result,
    COALESCE(MAX(CASE WHEN o.concept_id = 63270 THEN COALESCE(val_cn.name, o.value_text) END), '''') as travel_malaria,
    COALESCE(MAX(CASE WHEN o.concept_id IN (63266) THEN COALESCE(val_cn.name, IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text)) END), '''') as tb_screened,
    COALESCE(MAX(CASE WHEN o.concept_id IN (63267) THEN COALESCE(val_cn.name, o.value_text) END), '''') as tb_result,
    ''-'' as tb_eval_type,
    COALESCE(MAX(CASE WHEN o.concept_id IN (63267) THEN COALESCE(val_cn.name, o.value_text) END), '''') as tb_screening_result,
    IF(v.date_stopped IS NOT NULL, ''Discharged / Improved'', ''Admitted'') as condition_at_discharge,
    IF(p.dead = 1, IF(TIMESTAMPDIFF(HOUR, v.date_started, IFNULL(p.death_date, v.date_stopped)) <= 24, ''Within 24 hrs'', ''After 24 hrs''), ''-'') as death_in_ipd,
    IF(p.dead = 1, ''Yes'', ''No'') as death_notification,
    COALESCE(MAX(pm_attr.value), ''CBHI'') as payment_method,
    ''-'' as voucher_no,
    '''' as remark
FROM (
    SELECT e_filter.visit_id, v_inner.patient_id, v_inner.date_started, v_inner.date_stopped, v_inner.visit_type_id, v_inner.location_id, v_inner.uuid
    FROM (
        SELECT DISTINCT visit_id
        FROM encounter
        WHERE voided = 0 AND (
            location_id IN (267, 117, 130, 170, 77, 53, 157, 246, 67, 261, 211)
            OR encounter_type IN (3, 4, 5)
        )
        ORDER BY encounter_id DESC
        LIMIT 5000
    ) e_filter
    JOIN visit v_inner ON e_filter.visit_id = v_inner.visit_id
    WHERE v_inner.voided = 0
    ORDER BY v_inner.visit_id DESC
) v
JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
JOIN patient_identifier pi ON v.patient_id = pi.patient_id
JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
JOIN global_property gp ON gp.property = ''bahmni.primaryIdentifierType'' AND gp.property_value = pit.uuid
JOIN person p ON v.patient_id = p.person_id
JOIN person_name pn ON v.patient_id = pn.person_id AND pn.voided = 0
LEFT JOIN person_address pa ON v.patient_id = pa.person_id AND pa.voided = 0
LEFT JOIN encounter e ON v.visit_id = e.visit_id AND e.voided = 0
LEFT JOIN location el ON e.location_id = el.location_id
LEFT JOIN obs o ON e.encounter_id = o.encounter_id AND o.voided = 0
LEFT JOIN concept_name cn ON o.value_coded = cn.concept_id AND cn.concept_name_type = ''FULLY_SPECIFIED'' AND cn.locale = ''en''
LEFT JOIN concept_reference_map crm ON o.value_coded = crm.concept_id
LEFT JOIN concept_reference_term crt ON crm.concept_reference_term_id = crt.concept_reference_term_id
LEFT JOIN concept_name val_cn ON o.value_coded = val_cn.concept_id AND val_cn.concept_name_type = ''FULLY_SPECIFIED'' AND val_cn.locale = ''en''
LEFT JOIN person_attribute pm_attr ON v.patient_id = pm_attr.person_id AND pm_attr.person_attribute_type_id = 17 AND pm_attr.voided = 0
GROUP BY v.visit_id
ORDER BY v.visit_id DESC;',
  'Bed Management: Admission Register Query',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 8. Named SQL Query: emrapi.sqlSearch.newOrdersSearch
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emrapi.sqlSearch.newOrdersSearch',
  'SELECT TRIM(CONCAT(pn.given_name, IF(pn.middle_name IS NOT NULL AND pn.middle_name != '''', CONCAT('' '', pn.middle_name), ''''), IF(pn.family_name IS NOT NULL AND pn.family_name != '''', CONCAT('' '', pn.family_name), ''''))) AS name, COALESCE(pi.identifier, '''') AS identifier, ot.name AS orderType, COALESCE(cn.name, o.order_reason_non_coded, ''Order'') AS orderName, COALESCE(o.order_number, '''') AS orderNumber, DATE_FORMAT(o.date_activated, ''%Y-%m-%d %H:%i'') AS orderDateFormatted, DATE_FORMAT(o.date_activated, ''%Y-%m-%d'') AS orderDateOnly, IF(EXISTS(SELECT 1 FROM obs ob WHERE ob.order_id = o.order_id AND ob.voided = 0), ''true'', ''false'') AS isFulfilled, p.uuid AS uuid, o.uuid AS orderUuid, v.uuid AS activeVisitUuid, IF(va.value_reference = ''Admitted'', ''true'', ''false'') AS hasBeenAdmitted FROM orders o INNER JOIN order_type ot ON o.order_type_id = ot.order_type_id INNER JOIN encounter e ON o.encounter_id = e.encounter_id AND e.voided = 0 INNER JOIN visit v ON e.visit_id = v.visit_id AND v.voided = 0 INNER JOIN person p ON o.patient_id = p.person_id AND p.voided = 0 INNER JOIN person_name pn ON p.person_id = pn.person_id AND pn.preferred = 1 AND pn.voided = 0 LEFT JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.preferred = 1 AND pi.voided = 0 LEFT JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.concept_name_type = ''FULLY_SPECIFIED'' AND cn.locale = ''en'' AND cn.voided = 0 LEFT JOIN visit_attribute va ON va.visit_id = v.visit_id AND va.attribute_type_id = (SELECT visit_attribute_type_id FROM visit_attribute_type WHERE name = ''Admission Status'' LIMIT 1) AND va.voided = 0 WHERE o.order_type_id IN (5, 6, 8, 9) AND o.voided = 0 AND o.order_action != ''DISCONTINUE'' AND v.date_stopped IS NULL ORDER BY o.date_activated DESC',
  'Orders App: New Orders from Active Visits',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 9. Named SQL Query: emrapi.sqlSearch.backlogOrdersSearch
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emrapi.sqlSearch.backlogOrdersSearch',
  'SELECT TRIM(CONCAT(pn.given_name, IF(pn.middle_name IS NOT NULL AND pn.middle_name != '''', CONCAT('' '', pn.middle_name), ''''), IF(pn.family_name IS NOT NULL AND pn.family_name != '''', CONCAT('' '', pn.family_name), ''''))) AS name, COALESCE(pi.identifier, '''') AS identifier, ot.name AS orderType, COALESCE(cn.name, o.order_reason_non_coded, ''Order'') AS orderName, COALESCE(o.order_number, '''') AS orderNumber, DATE_FORMAT(o.date_activated, ''%Y-%m-%d %H:%i'') AS orderDateFormatted, DATE_FORMAT(o.date_activated, ''%Y-%m-%d'') AS orderDateOnly, IF(EXISTS(SELECT 1 FROM obs ob WHERE ob.order_id = o.order_id AND ob.voided = 0), ''true'', ''false'') AS isFulfilled, p.uuid AS uuid, o.uuid AS orderUuid, v.uuid AS activeVisitUuid, IF(va.value_reference = ''Admitted'', ''true'', ''false'') AS hasBeenAdmitted FROM orders o INNER JOIN order_type ot ON o.order_type_id = ot.order_type_id INNER JOIN encounter e ON o.encounter_id = e.encounter_id AND e.voided = 0 INNER JOIN visit v ON e.visit_id = v.visit_id AND v.voided = 0 INNER JOIN person p ON o.patient_id = p.person_id AND p.voided = 0 INNER JOIN person_name pn ON p.person_id = pn.person_id AND pn.preferred = 1 AND pn.voided = 0 LEFT JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.preferred = 1 AND pi.voided = 0 LEFT JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.concept_name_type = ''FULLY_SPECIFIED'' AND cn.locale = ''en'' AND cn.voided = 0 LEFT JOIN visit_attribute va ON va.visit_id = v.visit_id AND va.attribute_type_id = (SELECT visit_attribute_type_id FROM visit_attribute_type WHERE name = ''Admission Status'' LIMIT 1) AND va.voided = 0 WHERE o.order_type_id IN (5, 6, 8, 9) AND o.voided = 0 AND o.order_action != ''DISCONTINUE'' AND v.date_stopped IS NOT NULL ORDER BY o.date_activated DESC',
  'Orders App: Backlog Orders from Closed Visits',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 10. Named SQL Query: emrapi.sqlSearch.icuRegister
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emrapi.sqlSearch.icuRegister',
  'SELECT 
    v.visit_id,
    p.uuid as patient_uuid,
    v.uuid as visit_uuid,
    pi.identifier as mrn,
    TRIM(CONCAT(pn.given_name, IF(pn.middle_name IS NOT NULL AND pn.middle_name != '''', CONCAT('' '', pn.middle_name), ''''), IF(pn.family_name IS NOT NULL AND pn.family_name != '''', CONCAT('' '', pn.family_name), ''''))) as patient_name,
    p.gender as sex,
    TIMESTAMPDIFF(YEAR, p.birthdate, v.date_started) as age,
    COALESCE(pa.city_village, pa.address1, '''') as woreda,
    COALESCE(pa.address2, pa.county_district, '''') as kebele,
    DATE_FORMAT(v.date_started, ''%Y-%m-%d %H:%i:%s'') as admission_date,
    DATE_FORMAT(v.date_stopped, ''%Y-%m-%d %H:%i:%s'') as discharge_date,
    IF(v.date_stopped IS NULL, ''Admitted'', ''Discharged'') as status,
    DATEDIFF(IFNULL(v.date_stopped, NOW()), v.date_started) as length_of_stay,
    COALESCE(MAX(CASE WHEN el.name LIKE ''%ICU%'' OR el.name LIKE ''%HDU%'' THEN el.name END), vt.name, ''ICU'') as ward_name,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN COALESCE(cn.name, o.value_text) END SEPARATOR ''; ''), ''-'') as admission_diag_name,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN crt.code END SEPARATOR ''; ''), ''-'') as admission_diag_code,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN COALESCE(cn.name, o.value_text) END SEPARATOR ''; ''), ''-'') as discharge_diag_name,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN crt.code END SEPARATOR ''; ''), ''-'') as discharge_diag_code,
    COALESCE(MAX(CASE WHEN o.concept_id = 63657 THEN IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text) END), '''') as hiv_offered,
    COALESCE(MAX(CASE WHEN o.concept_id IN (22442, 63658) THEN IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text) END), '''') as hiv_performed,
    COALESCE(MAX(CASE WHEN o.concept_id = 63659 THEN COALESCE(val_cn.name, o.value_text) END), '''') as hiv_target_category,
    COALESCE(MAX(CASE WHEN o.concept_id IN (32992, 47297) THEN COALESCE(val_cn.name, o.value_text) END), '''') as hiv_result,
    COALESCE(MAX(CASE WHEN o.concept_id IN (67614, 68611, 68248, 17984, 19446, 19830, 20013) THEN ''Yes'' END), ''No'') as mech_vent,
    COALESCE(MAX(CASE WHEN o.concept_id IN (19978) THEN o.value_numeric END), ''0'') as vent_days,
    COALESCE(MAX(CASE WHEN o.concept_id IN (33107) THEN ''Yes'' END), ''No'') as vap_developed,
    COALESCE(MAX(CASE WHEN o.concept_id IN (8699, 67626) THEN ''Yes'' END), ''Yes'') as nutr_assessment,
    COALESCE(MAX(CASE WHEN o.concept_id IN (67572, 8699, 19315, 26015) THEN ''Yes'' END), ''Yes'') as nutr_support,
    COALESCE(MAX(CASE 
        WHEN o.concept_id IN (67573) THEN ''1. Enteral (PO)''
        WHEN o.concept_id IN (67575, 67576) THEN ''1. Enteral (Tube/NGT)''
        WHEN o.concept_id IN (12743, 19286, 26015) THEN ''2. Parenteral''
        WHEN o.concept_id IN (67574) THEN ''NPO''
    END), ''1. Enteral'') as feeding_type,
    IF(v.date_stopped IS NOT NULL, ''1. Improved'', ''Active / In ICU'') as outcome_at_discharge,
    IF(p.dead = 1, IF(TIMESTAMPDIFF(HOUR, v.date_started, IFNULL(p.death_date, v.date_stopped)) <= 24, ''1. Within 24 hrs'', ''2. After 24 hrs''), ''No'') as death_in_icu,
    IF(p.dead = 1, ''Yes'', ''No'') as death_notification,
    COALESCE(MAX(CASE WHEN o.concept_id IN (70046, 12469) THEN ''Yes'' END), ''No'') as readmission,
    COALESCE(MAX(CASE WHEN o.concept_id IN (12469) THEN ''1. Within 48 hrs'' END), ''-'') as readmission_timing,
    '''' as remark
FROM (
    SELECT v_inner.visit_id, v_inner.patient_id, v_inner.date_started, v_inner.date_stopped, v_inner.visit_type_id, v_inner.location_id, v_inner.uuid
    FROM visit v_inner
    JOIN visit_type vt_inner ON v_inner.visit_type_id = vt_inner.visit_type_id
    LEFT JOIN location vl_inner ON v_inner.location_id = vl_inner.location_id
    WHERE v_inner.voided = 0
      AND (
          vt_inner.name IN (''ICU'', ''NICU Ward'', ''Adult MICU'', ''Pedi HDU'', ''RETIRED_Adult MICU'', ''RETIRED_AICU Ward 179'')
          OR vl_inner.name IN (''ICU'', ''NICU Ward'', ''Adult MICU'', ''Pedi HDU'', ''RETIRED_Adult MICU'', ''RETIRED_AICU Ward 179'')
          OR v_inner.location_id IN (261, 53, 191, 17, 83, 23, 100, 221, 143)
      )
    ORDER BY v_inner.visit_id DESC
    LIMIT 1000
) v
JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
JOIN patient_identifier pi ON v.patient_id = pi.patient_id
JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
JOIN global_property gp ON gp.property = ''bahmni.primaryIdentifierType'' AND gp.property_value = pit.uuid
JOIN person p ON v.patient_id = p.person_id
JOIN person_name pn ON v.patient_id = pn.person_id AND pn.voided = 0
LEFT JOIN person_address pa ON v.patient_id = pa.person_id AND pa.voided = 0
LEFT JOIN encounter e ON v.visit_id = e.visit_id AND e.voided = 0
LEFT JOIN location el ON e.location_id = el.location_id
LEFT JOIN obs o ON e.encounter_id = o.encounter_id AND o.voided = 0
  AND o.concept_id IN (22, 11847, 11848, 63657, 22442, 63658, 63659, 32992, 47297, 67614, 68611, 68248, 17984, 19446, 19830, 20013, 19978, 33107, 8699, 67626, 67572, 19315, 26015, 67573, 67575, 67576, 12743, 19286, 67574, 70046, 12469)
LEFT JOIN concept_name cn ON o.value_coded = cn.concept_id AND cn.concept_name_type = ''FULLY_SPECIFIED'' AND cn.locale = ''en''
LEFT JOIN concept_reference_map crm ON o.value_coded = crm.concept_id
LEFT JOIN concept_reference_term crt ON crm.concept_reference_term_id = crt.concept_reference_term_id
LEFT JOIN concept_name val_cn ON o.value_coded = val_cn.concept_id AND val_cn.concept_name_type = ''FULLY_SPECIFIED'' AND val_cn.locale = ''en''
GROUP BY v.visit_id
ORDER BY v.visit_id DESC;',
  'ICU Register Query',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 11. Named SQL Query: emrapi.sqlSearch.liaisonRegister
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emrapi.sqlSearch.liaisonRegister',
  'SELECT 
    v.visit_id,
    p.uuid as patient_uuid,
    v.uuid as visit_uuid,
    pi.identifier AS mrn,
    TRIM(CONCAT(pn.given_name, IF(pn.middle_name IS NOT NULL AND pn.middle_name != '''', CONCAT('' '', pn.middle_name), ''''), IF(pn.family_name IS NOT NULL AND pn.family_name != '''', CONCAT('' '', pn.family_name), ''''))) AS patient_name,
    TIMESTAMPDIFF(YEAR, p.birthdate, v.date_started) AS age,
    p.gender AS sex,
    COALESCE(pa.state_province, ''Amhara'') AS region,
    COALESCE(pa.county_district, ''-'') AS subcity_zone,
    COALESCE(pa.city_village, pa.address1, ''-'') AS woreda_kebele,
    DATE_FORMAT(v.date_started, ''%Y-%m-%d %H:%i:%s'') AS service_date,
    IF(MAX(CASE WHEN o.concept_id IN (49, 69611, 69612, 69620, 21895, 57417, 28891) OR et.name = ''DISCHARGE'' OR et.name = ''TRANSFER'' THEN 1 END) = 1, ''Out'', ''In'') AS referral_type,
    COALESCE(MAX(CASE WHEN o.concept_id IN (67271, 68984, 57417, 28891) THEN COALESCE(val_cn.name, o.value_text) END), ''Dessie Comprehensive Specialized Hospital'') AS facility_name,
    IF(vt.name LIKE ''%Emergency%'' OR MAX(CASE WHEN o.concept_id = 69611 AND o.value_text LIKE ''%Emerg%'' THEN 1 END) = 1, ''Emergency'', ''Cold / Elective'') AS case_type,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 67272) THEN COALESCE(cn.name, o.value_text) END SEPARATOR ''; ''), ''Medical Evaluation'') AS diagnosis,
    COALESCE(MAX(CASE WHEN o.concept_id = 69612 THEN o.value_text END), MAX(CASE WHEN el.name != ''BORUMEDA GENERAL HOSPITAL'' THEN el.name END), vt.name, ''Liaison'') AS department,
    COALESCE(MAX(CASE WHEN o.concept_id IN (21895, 67273, 11084) THEN o.value_text END), ''Specialized Investigation / Management'') AS reason_for_referral,
    COALESCE(MAX(CASE WHEN o.concept_id IN (69611) AND o.value_text LIKE ''%Ambulance%'' THEN ''Yes'' END), IF(vt.name LIKE ''%Emergency%'', ''Yes'', ''No'')) AS ambulance_dispatched,
    ''Yes'' AS communication_done,
    COALESCE(MAX(pm_attr.value), ''CBHI'') AS payment_type,
    ''Yes'' AS feedback_sent_received,
    COALESCE(MAX(CASE WHEN o.concept_id = 69621 THEN o.value_text END), '''') AS remark
FROM (
    SELECT e_filter.visit_id, v_inner.patient_id, v_inner.date_started, v_inner.visit_type_id, v_inner.location_id, v_inner.uuid
    FROM (
        SELECT DISTINCT visit_id
        FROM (
            (SELECT visit_id FROM encounter WHERE location_id = 24 AND voided = 0 ORDER BY encounter_id DESC LIMIT 500)
            UNION
            (SELECT visit_id FROM encounter WHERE encounter_type IN (3, 4, 5) AND voided = 0 ORDER BY encounter_id DESC LIMIT 500)
            UNION
            (SELECT visit_id FROM visit WHERE visit_type_id = 18 AND voided = 0 ORDER BY visit_id DESC LIMIT 200)
            UNION
            (SELECT e.visit_id FROM obs o JOIN encounter e ON o.encounter_id = e.encounter_id WHERE o.concept_id IN (61954, 49) AND o.voided = 0 ORDER BY o.obs_id DESC LIMIT 500)
        ) ref_visits
        ORDER BY visit_id DESC
        LIMIT 1000
    ) e_filter
    JOIN visit v_inner ON e_filter.visit_id = v_inner.visit_id
    WHERE v_inner.voided = 0
    ORDER BY v_inner.visit_id DESC
) v
JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
JOIN patient_identifier pi ON v.patient_id = pi.patient_id
JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
JOIN global_property gp ON gp.property = ''bahmni.primaryIdentifierType'' AND gp.property_value = pit.uuid
JOIN person p ON v.patient_id = p.person_id
JOIN person_name pn ON v.patient_id = pn.person_id AND pn.voided = 0
LEFT JOIN person_address pa ON v.patient_id = pa.person_id AND pa.voided = 0
LEFT JOIN encounter e ON v.visit_id = e.visit_id AND e.voided = 0
LEFT JOIN encounter_type et ON e.encounter_type = et.encounter_type_id
LEFT JOIN location el ON e.location_id = el.location_id
LEFT JOIN obs o ON e.encounter_id = o.encounter_id AND o.voided = 0
  AND o.concept_id IN (22, 11847, 67272, 61954, 67271, 60880, 67273, 69611, 69612, 69620, 68984, 68985, 21895, 49, 57417, 28891, 69621)
LEFT JOIN concept_name cn ON o.value_coded = cn.concept_id AND cn.concept_name_type = ''FULLY_SPECIFIED'' AND cn.locale = ''en''
LEFT JOIN concept_name val_cn ON o.value_coded = val_cn.concept_id AND val_cn.concept_name_type = ''FULLY_SPECIFIED'' AND val_cn.locale = ''en''
LEFT JOIN person_attribute pm_attr ON v.patient_id = pm_attr.person_id AND pm_attr.person_attribute_type_id = 17 AND pm_attr.voided = 0
GROUP BY v.visit_id
ORDER BY v.visit_id DESC;',
  'Liaison Register Query',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 12. Named SQL Query: emrapi.sqlSearch.opdRegister
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emrapi.sqlSearch.opdRegister',
  'SELECT 
    v.visit_id,
    p.uuid as patient_uuid,
    v.uuid as visit_uuid,
    pi.identifier as mrn,
    TRIM(CONCAT(pn.given_name, IF(pn.middle_name IS NOT NULL AND pn.middle_name != '''', CONCAT('' '', pn.middle_name), ''''), IF(pn.family_name IS NOT NULL AND pn.family_name != '''', CONCAT('' '', pn.family_name), ''''))) as patient_name,
    p.gender as sex,
    TIMESTAMPDIFF(YEAR, p.birthdate, v.date_started) as age,
    COALESCE(pa.city_village, pa.address1, '''') as woreda,
    COALESCE(pa.address2, pa.county_district, '''') as kebele,
    COALESCE(pa.state_province, ''Amhara'') as region,
    DATE_FORMAT(v.date_started, ''%Y-%m-%d %H:%i:%s'') as service_date,
    vt.name as visit_type_name,
    CASE 
        WHEN vl.name IS NOT NULL AND vl.name != ''BORUMEDA GENERAL HOSPITAL'' THEN vl.name
        ELSE vt.name
    END as visit_location,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN COALESCE(cn.name, o.value_text) END SEPARATOR ''; ''), ''-'') as diagnosis_name,
    IFNULL(GROUP_CONCAT(DISTINCT CASE WHEN o.concept_id IN (22, 11847, 11848) THEN crt.code END SEPARATOR ''; ''), ''-'') as icd11_code,
    IF(MAX(CASE WHEN o.concept_id = 11849 THEN cn_occ.name END) = ''Repeat'', ''Repeat'', ''New'') as patient_status,
    '''' as admitted_mark,
    COALESCE(MAX(CASE WHEN o.concept_id IN (3325, 11924) THEN COALESCE(val_cn.name, o.value_text) END), '''') as rta_type,
    COALESCE(MAX(CASE WHEN o.concept_id = 63657 THEN IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text) END), '''') as hiv_offered,
    COALESCE(MAX(CASE WHEN o.concept_id IN (22442, 63658) THEN IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text) END), '''') as hiv_performed,
    COALESCE(MAX(CASE WHEN o.concept_id IN (32992, 47297) THEN COALESCE(val_cn.name, o.value_text) END), '''') as hiv_result,
    COALESCE(MAX(CASE WHEN o.concept_id = 63659 THEN COALESCE(val_cn.name, o.value_text) END), '''') as hiv_target_category,
    COALESCE(MAX(CASE WHEN o.concept_id IN (63266) THEN COALESCE(val_cn.name, IF(o.value_coded IS NOT NULL, ''Yes'', o.value_text)) END), '''') as tb_screened,
    COALESCE(MAX(CASE WHEN o.concept_id IN (63267) THEN COALESCE(val_cn.name, o.value_text) END), '''') as tb_result,
    COALESCE(MAX(CASE WHEN o.concept_id = 63268 THEN COALESCE(val_cn.name, o.value_text) END), '''') as tb_eval_type,
    COALESCE(MAX(CASE WHEN o.concept_id = 63269 THEN COALESCE(val_cn.name, o.value_text) END), '''') as tb_code,
    COALESCE(MAX(CASE WHEN o.concept_id = 63270 THEN COALESCE(val_cn.name, o.value_text) END), '''') as travel_malaria,
    COALESCE(MAX(CASE WHEN o.concept_id = 49 THEN o.value_text END), '''') as referred_to,
    IF(p.dead = 1, ''Yes'', ''No'') as died,
    IF(p.dead = 1, ''Yes'', ''No'') as death_notified,
    '''' as remark
FROM (
    SELECT v_inner.visit_id, v_inner.patient_id, v_inner.date_started, v_inner.visit_type_id, v_inner.location_id, v_inner.uuid
    FROM visit v_inner
    JOIN visit_type vt_inner ON v_inner.visit_type_id = vt_inner.visit_type_id
    LEFT JOIN location vl_inner ON v_inner.location_id = vl_inner.location_id
    WHERE v_inner.voided = 0
      AND vt_inner.name NOT LIKE ''%Ward%''
      AND vt_inner.name NOT IN (''ICU'', ''Adult MICU'', ''Pedi HDU'', ''PNC A'', ''PNC B'', ''SAM'', ''preterm ward'', ''IPD'', ''Labor Ward'', ''Delivery Room'', ''Eye Ward'', ''Medical Ward'', ''Surgical Ward'', ''NICU Ward'')
      AND (vl_inner.name IS NULL OR (vl_inner.name NOT LIKE ''%Ward%'' AND vl_inner.name NOT IN (''ICU'', ''Adult MICU'', ''Pedi HDU'', ''PNC A'', ''PNC B'', ''SAM'', ''preterm ward'', ''IPD'', ''Labor Ward'', ''Delivery Room'', ''Eye Ward'', ''Medical Ward'', ''Surgical Ward'', ''NICU Ward'')))
    ORDER BY v_inner.visit_id DESC
    LIMIT 40000
) v
JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
LEFT JOIN location vl ON v.location_id = vl.location_id
JOIN patient_identifier pi ON v.patient_id = pi.patient_id
JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
JOIN global_property gp ON gp.property = ''bahmni.primaryIdentifierType'' AND gp.property_value = pit.uuid
JOIN person p ON v.patient_id = p.person_id
JOIN person_name pn ON v.patient_id = pn.person_id AND pn.voided = 0
LEFT JOIN person_address pa ON v.patient_id = pa.person_id AND pa.voided = 0
LEFT JOIN encounter e ON v.visit_id = e.visit_id AND e.voided = 0
LEFT JOIN obs o ON e.encounter_id = o.encounter_id AND o.voided = 0 
  AND o.concept_id IN (22, 11847, 11848, 11849, 3325, 11924, 63657, 22442, 63658, 32992, 47297, 63659, 63266, 63267, 63268, 63269, 63270, 49)
LEFT JOIN concept_name cn ON o.value_coded = cn.concept_id AND cn.concept_name_type = ''FULLY_SPECIFIED'' AND cn.locale = ''en''
LEFT JOIN concept_reference_map crm ON o.value_coded = crm.concept_id
LEFT JOIN concept_reference_term crt ON crm.concept_reference_term_id = crt.concept_reference_term_id
LEFT JOIN concept_name cn_occ ON o.value_coded = cn_occ.concept_id AND cn_occ.concept_name_type = ''FULLY_SPECIFIED'' AND o.concept_id = 11849
LEFT JOIN concept_name val_cn ON o.value_coded = val_cn.concept_id AND val_cn.concept_name_type = ''FULLY_SPECIFIED'' AND val_cn.locale = ''en''
GROUP BY v.visit_id
ORDER BY v.visit_id DESC;',
  'OPD Register Query',
  UUID()
) ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

SELECT 'SUCCESS: All named queries and admin privileges configured.' AS status;
