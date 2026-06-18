-- Main Diagnosis Report
-- Extracts the main diagnosis (PRIMARY with ICD-11) with occurrence for each encounter
-- ICD-11 code and occurrence stored in obs.comments as: [ICD11:code][OCC:New/Repeat]
-- Data is saved to the database via the encounter transaction mapper

SELECT 
    pi.identifier as patient_id,
    p.uuid as patient_uuid,
    p.gender,
    TIMESTAMPDIFF(YEAR, p.birthdate, CURDATE()) as age,
    e.encounter_id,
    e.encounter_datetime,
    o.obs_id,
    cn.name as diagnosis_name,
    REGEXP_SUBSTR(o.comments, '\\[ICD11:([^\\]]+)\\]', 1, 1, NULL, 1) as icd11_code,
    REGEXP_SUBSTR(o.comments, '\\[OCC:([^\\]]+)\\]', 1, 1, NULL, 1) as occurrence,
    o.comments as raw_comments
FROM obs o
JOIN concept_name cn ON cn.concept_id = o.concept_id 
    AND cn.locale_preferred = 1 
    AND cn.voided = 0
JOIN encounter e ON e.encounter_id = o.encounter_id
JOIN person p ON p.person_id = o.person_id
LEFT JOIN patient_identifier pi ON pi.patient_id = p.person_id 
    AND pi.preferred = 1 
    AND pi.voided = 0
WHERE o.comments LIKE '[ICD11:%'
    AND o.voided = 0
    AND cn.locale = 'en'
ORDER BY e.encounter_datetime DESC;

-- Breakdown by occurrence for reporting
SELECT 
    REGEXP_SUBSTR(o.comments, '\\[OCC:([^\\]]+)\\]', 1, 1, NULL, 1) as occurrence,
    COUNT(*) as total,
    COUNT(DISTINCT e.encounter_id) as unique_encounters,
    COUNT(DISTINCT o.person_id) as unique_patients
FROM obs o
JOIN encounter e ON e.encounter_id = o.encounter_id
WHERE o.comments LIKE '[ICD11:%'
    AND o.voided = 0
GROUP BY occurrence;
