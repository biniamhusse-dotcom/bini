-- =========================================================================
-- OpenMRS Health Facility Server Hotfixes & Resiliency Bootstrap Script
-- Automatically applied during deployment to prevent registration, audit log,
-- and dispensing register errors across all health facility servers.
-- =========================================================================

-- 1. Ensure canonical concept UUIDs and ensure valid fully specified names
UPDATE concept SET uuid = '8cf89033-94c2-4c03-b454-bc6ff20b1b4b' WHERE concept_id = 65282;

INSERT IGNORE INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
VALUES (0, 3, 11, 0, 1, NOW(), 'fd08aa37-e18d-415d-be41-f8bbbc81bea3');

-- 1a. Unvoid any FULLY_SPECIFIED name mistakenly voided as duplicate
UPDATE concept_name 
SET voided = 0, void_reason = NULL 
WHERE voided = 1 
  AND concept_name_type = 'FULLY_SPECIFIED' 
  AND void_reason = 'Duplicate name on same concept';

-- 1b. Void redundant non-FULLY_SPECIFIED duplicate names on same concept where FULLY_SPECIFIED exists
UPDATE concept_name cn
JOIN (
    SELECT concept_id, name, locale
    FROM concept_name
    WHERE voided = 0
    GROUP BY concept_id, name, locale
    HAVING count(*) > 1
) dup ON cn.concept_id = dup.concept_id AND cn.name = dup.name AND cn.locale = dup.locale
JOIN (
    SELECT concept_id, name, locale
    FROM concept_name
    WHERE voided = 0 AND concept_name_type = 'FULLY_SPECIFIED'
) fs ON cn.concept_id = fs.concept_id AND cn.name = fs.name AND cn.locale = fs.locale
SET cn.voided = 1, cn.void_reason = 'Redundant duplicate of fully specified name'
WHERE cn.voided = 0 
  AND (cn.concept_name_type IS NULL OR cn.concept_name_type != 'FULLY_SPECIFIED');

-- 1c. For any active concept with 0 active FULLY_SPECIFIED names, promote one name
UPDATE concept_name cn
JOIN (
    SELECT c.concept_id, MIN(cn2.concept_name_id) as min_cn_id
    FROM concept c
    JOIN concept_name cn2 ON c.concept_id = cn2.concept_id AND cn2.voided = 0
    WHERE c.retired = 0
      AND NOT EXISTS (
          SELECT 1 FROM concept_name fs 
          WHERE fs.concept_id = c.concept_id 
            AND fs.concept_name_type = 'FULLY_SPECIFIED' 
            AND fs.voided = 0
      )
    GROUP BY c.concept_id
) missing_fs ON cn.concept_name_id = missing_fs.min_cn_id
SET cn.concept_name_type = 'FULLY_SPECIFIED', cn.locale_preferred = 1;

-- 1d. Ensure eapts_drug_mapping table exists
CREATE TABLE IF NOT EXISTS eapts_drug_mapping (
  openmrs_drug_id INT NOT NULL PRIMARY KEY,
  dagu_item_uuid VARCHAR(50) DEFAULT NULL,
  dagu_item_name VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

SET @fallback_cid = (SELECT concept_id FROM concept WHERE uuid = 'fd08aa37-e18d-415d-be41-f8bbbc81bea3' LIMIT 1);

INSERT IGNORE INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @fallback_cid, 'N/A', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @fallback_cid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM concept_name WHERE concept_id = @fallback_cid);

-- 2. Cleanup orphaned patient_id references in audit_log to prevent ObjectNotFoundException
UPDATE audit_log al 
LEFT JOIN patient p ON al.patient_id = p.patient_id 
SET al.patient_id = NULL 
WHERE al.patient_id IS NOT NULL AND p.patient_id IS NULL;

-- 3. Ensure audit_log message is never NULL
UPDATE audit_log SET message = 'AUDIT_LOG_ENTRY' WHERE message IS NULL;

-- 4. Ensure emr.prescription.dispensingRegister named query exists in global_property
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emr.prescription.dispensingRegister',
  'SELECT enc.uuid AS encounter_uuid, DATE_FORMAT(MIN(o.date_activated), ''%Y-%m-%d'') AS rx_date, COALESCE(pi.identifier, '''') AS mrn, TRIM(CONCAT(ptn.given_name, '' '', COALESCE(ptn.middle_name, ''''), '' '', COALESCE(ptn.family_name, ''''))) AS patient_name, TIMESTAMPDIFF(YEAR, pt.birthdate, CURDATE()) AS age, pt.gender AS sex, pt.uuid AS patient_uuid, COALESCE(diag_visit.diag_names, diag_enc.diag_names, diag_pt.diag_names, '''') AS diagnosis_name, COALESCE(diag_visit.diag_codes, diag_enc.diag_codes, diag_pt.diag_codes, '''') AS icd11_code, GROUP_CONCAT(DISTINCT CONCAT(COALESCE(dr.name, doord.drug_non_coded, ''''), IF(dr.strength IS NOT NULL AND dr.strength != '''', CONCAT('' '', dr.strength), '''')) ORDER BY o.order_id SEPARATOR '', '') AS medicines_prescribed, COUNT(DISTINCT o.order_id) AS total_meds, CASE WHEN COUNT(DISTINCT o.order_id) > 0 AND SUM(CASE WHEN COALESCE(st_obs.value_text, ''ISSUED'') = ''DISPENSED'' THEN 1 ELSE 0 END) = COUNT(DISTINCT o.order_id) THEN 1 ELSE 0 END AS all_dispensed FROM orders o INNER JOIN drug_order doord ON o.order_id = doord.order_id INNER JOIN encounter enc ON o.encounter_id = enc.encounter_id INNER JOIN person pt ON o.patient_id = pt.person_id INNER JOIN person_name ptn ON pt.person_id = ptn.person_id AND ptn.preferred = 1 AND ptn.voided = 0 LEFT JOIN patient_identifier pi ON pt.person_id = pi.patient_id AND pi.preferred = 1 AND pi.voided = 0 LEFT JOIN drug dr ON doord.drug_inventory_id = dr.drug_id LEFT JOIN ( SELECT ob_s.order_id, SUBSTRING_INDEX(GROUP_CONCAT(ob_s.value_text ORDER BY ob_s.obs_datetime DESC, ob_s.obs_id DESC SEPARATOR ''|||''), ''|||'', 1) AS value_text FROM obs ob_s WHERE ob_s.concept_id = (SELECT concept_id FROM concept WHERE uuid = ''97a9b0ad-ca27-44bb-96c8-fc0502ce09e6'' LIMIT 1) AND ob_s.voided = 0 GROUP BY ob_s.order_id ) st_obs ON st_obs.order_id = o.order_id LEFT JOIN ( SELECT all_d.visit_id, GROUP_CONCAT(DISTINCT all_d.diag_name ORDER BY all_d.diag_datetime DESC SEPARATOR '', '') AS diag_names, GROUP_CONCAT(DISTINCT all_d.diag_code ORDER BY (all_d.source_name = ''Ethiopia ICD-11'') DESC, (all_d.source_name LIKE ''%ICD-11%'') DESC SEPARATOR '', '') AS diag_codes FROM ( SELECT e_d.visit_id, e_d.encounter_id, ob_d.person_id, COALESCE(cn_val.name, ob_d.value_text) AS diag_name, cr.code AS diag_code, crs.name AS source_name, ob_d.obs_datetime AS diag_datetime FROM obs ob_d INNER JOIN encounter e_d ON ob_d.encounter_id = e_d.encounter_id AND e_d.voided = 0 LEFT JOIN concept_name cn_val ON ob_d.value_coded = cn_val.concept_id AND cn_val.concept_name_type = ''FULLY_SPECIFIED'' AND cn_val.locale = ''en'' LEFT JOIN concept_reference_map crm ON ob_d.value_coded = crm.concept_id LEFT JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id LEFT JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id WHERE ob_d.voided = 0 AND ob_d.concept_id IN (21, 22, 27028) UNION ALL SELECT enc_ed.visit_id, ed.encounter_id, ed.patient_id AS person_id, COALESCE(cn_diag.name, ed.diagnosis_non_coded) AS diag_name, cr.code AS diag_code, crs.name AS source_name, ed.date_created AS diag_datetime FROM encounter_diagnosis ed INNER JOIN encounter enc_ed ON ed.encounter_id = enc_ed.encounter_id AND enc_ed.voided = 0 LEFT JOIN concept_name cn_diag ON ed.diagnosis_coded = cn_diag.concept_id AND cn_diag.concept_name_type = ''FULLY_SPECIFIED'' AND cn_diag.locale = ''en'' LEFT JOIN concept_reference_map crm ON ed.diagnosis_coded = crm.concept_id LEFT JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id LEFT JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id WHERE ed.voided = 0 ) all_d WHERE all_d.visit_id IS NOT NULL GROUP BY all_d.visit_id ) diag_visit ON diag_visit.visit_id = enc.visit_id AND enc.visit_id IS NOT NULL LEFT JOIN ( SELECT all_d.encounter_id, GROUP_CONCAT(DISTINCT all_d.diag_name ORDER BY all_d.diag_datetime DESC SEPARATOR '', '') AS diag_names, GROUP_CONCAT(DISTINCT all_d.diag_code ORDER BY (all_d.source_name = ''Ethiopia ICD-11'') DESC, (all_d.source_name LIKE ''%ICD-11%'') DESC SEPARATOR '', '') AS diag_codes FROM ( SELECT e_d.visit_id, e_d.encounter_id, ob_d.person_id, COALESCE(cn_val.name, ob_d.value_text) AS diag_name, cr.code AS diag_code, crs.name AS source_name, ob_d.obs_datetime AS diag_datetime FROM obs ob_d INNER JOIN encounter e_d ON ob_d.encounter_id = e_d.encounter_id AND e_d.voided = 0 LEFT JOIN concept_name cn_val ON ob_d.value_coded = cn_val.concept_id AND cn_val.concept_name_type = ''FULLY_SPECIFIED'' AND cn_val.locale = ''en'' LEFT JOIN concept_reference_map crm ON ob_d.value_coded = crm.concept_id LEFT JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id LEFT JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id WHERE ob_d.voided = 0 AND ob_d.concept_id IN (21, 22, 27028) UNION ALL SELECT enc_ed.visit_id, ed.encounter_id, ed.patient_id AS person_id, COALESCE(cn_diag.name, ed.diagnosis_non_coded) AS diag_name, cr.code AS diag_code, crs.name AS source_name, ed.date_created AS diag_datetime FROM encounter_diagnosis ed INNER JOIN encounter enc_ed ON ed.encounter_id = enc_ed.encounter_id AND enc_ed.voided = 0 LEFT JOIN concept_name cn_diag ON ed.diagnosis_coded = cn_diag.concept_id AND cn_diag.concept_name_type = ''FULLY_SPECIFIED'' AND cn_diag.locale = ''en'' LEFT JOIN concept_reference_map crm ON ed.diagnosis_coded = crm.concept_id LEFT JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id LEFT JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id WHERE ed.voided = 0 ) all_d GROUP BY all_d.encounter_id ) diag_enc ON diag_enc.encounter_id = enc.encounter_id LEFT JOIN ( SELECT all_d.person_id, GROUP_CONCAT(DISTINCT all_d.diag_name ORDER BY all_d.diag_datetime DESC SEPARATOR '', '') AS diag_names, GROUP_CONCAT(DISTINCT all_d.diag_code ORDER BY (all_d.source_name = ''Ethiopia ICD-11'') DESC, (all_d.source_name LIKE ''%ICD-11%'') DESC SEPARATOR '', '') AS diag_codes FROM ( SELECT e_d.visit_id, e_d.encounter_id, ob_d.person_id, COALESCE(cn_val.name, ob_d.value_text) AS diag_name, cr.code AS diag_code, crs.name AS source_name, ob_d.obs_datetime AS diag_datetime FROM obs ob_d INNER JOIN encounter e_d ON ob_d.encounter_id = e_d.encounter_id AND e_d.voided = 0 LEFT JOIN concept_name cn_val ON ob_d.value_coded = cn_val.concept_id AND cn_val.concept_name_type = ''FULLY_SPECIFIED'' AND cn_val.locale = ''en'' LEFT JOIN concept_reference_map crm ON ob_d.value_coded = crm.concept_id LEFT JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id LEFT JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id WHERE ob_d.voided = 0 AND ob_d.concept_id IN (21, 22, 27028) UNION ALL SELECT enc_ed.visit_id, ed.encounter_id, ed.patient_id AS person_id, COALESCE(cn_diag.name, ed.diagnosis_non_coded) AS diag_name, cr.code AS diag_code, crs.name AS source_name, ed.date_created AS diag_datetime FROM encounter_diagnosis ed INNER JOIN encounter enc_ed ON ed.encounter_id = enc_ed.encounter_id AND enc_ed.voided = 0 LEFT JOIN concept_name cn_diag ON ed.diagnosis_coded = cn_diag.concept_id AND cn_diag.concept_name_type = ''FULLY_SPECIFIED'' AND cn_diag.locale = ''en'' LEFT JOIN concept_reference_map crm ON ed.diagnosis_coded = crm.concept_id LEFT JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id LEFT JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id WHERE ed.voided = 0 ) all_d GROUP BY all_d.person_id ) diag_pt ON diag_pt.person_id = o.patient_id WHERE o.order_type_id = 2 AND o.voided = 0 AND o.order_action != ''DISCONTINUE'' AND o.date_activated IS NOT NULL AND NOT EXISTS (SELECT 1 FROM orders o_next WHERE o_next.previous_order_id = o.order_id AND o_next.voided = 0) GROUP BY enc.uuid, pi.identifier, ptn.given_name, ptn.middle_name, ptn.family_name, pt.birthdate, pt.gender, pt.uuid, diag_visit.diag_names, diag_visit.diag_codes, diag_enc.diag_names, diag_enc.diag_codes, diag_pt.diag_names, diag_pt.diag_codes ORDER BY MIN(o.date_activated) DESC',
  'Named query for Facility Dispensing Register Book',
  UUID()
)
ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);

-- 5. Ensure emr.eapts.api and emr.eapts.api.dtp queries exist in global_property
INSERT INTO global_property (property, property_value, description, uuid)
VALUES (
  'emr.eapts.api',
  'SELECT pn.given_name AS prescriber_firstName, pn.middle_name AS prescriber_middleName, pn.family_name AS prescriber_lastName, ''Doctor'' AS prescriber_role, '''' AS prescriber_registrationNumber, prov.uuid AS prescriber_rowGuid, ptn.given_name AS firstName, ptn.middle_name AS middleName, ptn.family_name AS lastName, COALESCE(phone_attr.value, '''') AS phoneNumber, TIMESTAMPDIFF(YEAR, pt.birthdate, CURDATE()) AS age, 0 AS weight, pt.gender AS sex, '''' AS houseNumber, COALESCE(pi.identifier, '''') AS cardNumber, pt.uuid AS patient_rowGuid, COALESCE(NULLIF(pmt_c.uuid, ''''), ''4a9afabb-f066-4267-a943-e489409368f3'') AS paymentType, '''' AS sponsorName, ''c5129e01-02b6-44e5-8386-7f5c5a7f9266'' AS patientTypeId, COALESCE(pa.address5, '''') AS woredaId, doord.dose AS dose, COALESCE(doord.dose, 0) AS strength, doord.quantity AS quantity, doord.duration_units AS duration_units, doord.duration AS numberOfDuration, COALESCE(doord.dosing_instructions, '''') AS additionalNote, o.order_id AS orderNumber, COALESCE(route_c.uuid, ''01d045a0-adf0-4065-9f5d-4fdc65c3ea92'') AS administrationId, COALESCE(freq_c.uuid, ''488b58ff-64f5-4f8a-8979-fa79940b1594'') AS frequencyTypeId, COALESCE(dm.dagu_item_uuid, d.uuid) AS itemUnitId, DATE_FORMAT(o.date_activated, ''%Y-%m-%dT%H:%i:%s.000Z'') AS prescriptionDate, COALESCE(diag.diag_uuids, '''') AS diagnosises, COALESCE(diag.diag_info, '''') AS additionalInfo, enc.uuid AS rowGuid FROM orders o JOIN drug_order doord ON o.order_id = doord.order_id JOIN drug d ON doord.drug_inventory_id = d.drug_id JOIN encounter enc ON o.encounter_id = enc.encounter_id JOIN person pt ON o.patient_id = pt.person_id JOIN patient pat ON pt.person_id = pat.patient_id JOIN person_name ptn ON pt.person_id = ptn.person_id AND ptn.preferred = 1 JOIN encounter_provider ep ON enc.encounter_id = ep.encounter_id JOIN provider prov ON ep.provider_id = prov.provider_id JOIN person_name pn ON prov.person_id = pn.person_id LEFT JOIN patient_identifier pi ON pat.patient_id = pi.patient_id AND pi.preferred = 1 LEFT JOIN person_attribute phone_attr ON pt.person_id = phone_attr.person_id AND phone_attr.person_attribute_type_id = 14 LEFT JOIN person_attribute pm ON pt.person_id = pm.person_id AND pm.person_attribute_type_id = 22 LEFT JOIN person_address pa ON pt.person_id = pa.person_id AND pa.preferred = 1 LEFT JOIN concept pmt_c ON pmt_c.concept_id = pm.value + 0 LEFT JOIN concept route_c ON route_c.concept_id = doord.route LEFT JOIN order_frequency ord_freq ON ord_freq.order_frequency_id = doord.frequency LEFT JOIN concept freq_c ON freq_c.concept_id = ord_freq.concept_id LEFT JOIN eapts_drug_mapping dm ON doord.drug_inventory_id = dm.openmrs_drug_id LEFT JOIN ( SELECT obs.encounter_id, GROUP_CONCAT(DISTINCT cn_diag.uuid SEPARATOR ''#'') AS diag_uuids, COALESCE(MAX(CASE WHEN obs.obs_id IS NOT NULL THEN obs.value_text ELSE '''' END), '''') AS diag_info FROM obs JOIN concept_name cn_diag ON obs.value_coded = cn_diag.concept_id AND cn_diag.concept_name_type = ''FULLY_SPECIFIED'' AND cn_diag.voided = 0 WHERE obs.concept_id = 22 AND obs.voided = 0 GROUP BY obs.encounter_id ) diag ON enc.encounter_id = diag.encounter_id WHERE o.order_type_id = 2 AND o.voided = 0 ORDER BY o.date_activated DESC',
  'emr.eapts.api - Active prescription sync to Dagu',
  UUID()
)
ON DUPLICATE KEY UPDATE property_value = VALUES(property_value);
