-- =========================================================================
-- OpenMRS Health Facility Server Hotfixes & Resiliency Bootstrap Script
-- Automatically applied during deployment to prevent registration, audit log,
-- and dispensing register errors across all health facility servers.
-- =========================================================================

-- 1. Ensure canonical concept UUIDs and clean duplicate concept names
UPDATE concept SET uuid = '8cf89033-94c2-4c03-b454-bc6ff20b1b4b' WHERE concept_id = 65282;

INSERT IGNORE INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
VALUES (0, 3, 11, 0, 1, NOW(), 'fd08aa37-e18d-415d-be41-f8bbbc81bea3');

UPDATE concept_name cn
JOIN (
    SELECT MIN(concept_name_id) as keep_id, concept_id, name, locale
    FROM concept_name
    WHERE voided = 0
    GROUP BY concept_id, name, locale
    HAVING count(*) > 1
) dup ON cn.concept_id = dup.concept_id 
     AND cn.name = dup.name 
     AND cn.locale = dup.locale 
     AND cn.concept_name_id > dup.keep_id
SET cn.voided = 1, cn.void_reason = 'Duplicate name on same concept';

UPDATE concept_name cn
JOIN (
    SELECT MIN(concept_name_id) as keep_id, name, locale
    FROM concept_name
    WHERE voided = 0 AND concept_name_type = 'FULLY_SPECIFIED'
    GROUP BY name, locale
    HAVING count(*) > 1
) dup ON cn.name = dup.name 
     AND cn.locale = dup.locale 
     AND cn.concept_name_id > dup.keep_id
SET cn.concept_name_type = NULL;

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
