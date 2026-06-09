SELECT
    @row_number := @row_number + 1 AS "S/No (1)",
    DATE_FORMAT(e.encounter_datetime, '%d/%m/%Y') AS "Service Date (2)",
    IFNULL(pi.identifier, '-') AS "MRN (3)",
    CASE 
        WHEN TIMESTAMPDIFF(YEAR, p.birthdate, e.encounter_datetime) > 0 THEN CONCAT(TIMESTAMPDIFF(YEAR, p.birthdate, e.encounter_datetime), ' Y')
        WHEN TIMESTAMPDIFF(MONTH, p.birthdate, e.encounter_datetime) > 0 THEN CONCAT(TIMESTAMPDIFF(MONTH, p.birthdate, e.encounter_datetime), ' M')
        ELSE CONCAT(TIMESTAMPDIFF(DAY, p.birthdate, e.encounter_datetime), ' D')
    END AS "Age (4)",
    IFNULL(p.gender, '-') AS "Sex (5)",
    IF(CONCAT_WS(', ', pa.address3, pa.city_village) = '', '-', CONCAT_WS(', ', pa.address3, pa.city_village)) AS "Address (6)",
    
    /* Diagnosis Column */
    IFNULL(GROUP_CONCAT(DISTINCT IF(c_diag.class_id = 4, cn_diag.name, NULL) SEPARATOR '; '), 'No Diag') AS "Diagnosis (7)",
    
    /* Checkboxes & Reason Codes */
    IFNULL(MAX(CASE WHEN cn.name IN ('Type of Visit', 'Visit Type') AND cv.name = 'New' THEN '✓' END), '-') AS "New (8)",
    IFNULL(MAX(CASE WHEN cn.name IN ('Type of Visit', 'Visit Type') AND cv.name = 'Repeat' THEN '✓' END), '-') AS "Repeat (9)",
    IFNULL(MAX(CASE WHEN cn.name LIKE '%Traffic%' THEN cv.name END), '-') AS "RTA (10)",
    
    /* PIHCT */
    IFNULL(MAX(CASE WHEN cn.name LIKE '%HIV Test Offered%' AND cv.name = 'Yes' THEN '✓' END), 'ND') AS "HIV Offered (11)",
    IFNULL(MAX(CASE WHEN cn.name LIKE '%HIV Test Performed%' AND cv.name = 'Yes' THEN '✓' END), 'ND') AS "HIV Performed (12)",
    IFNULL(MAX(CASE WHEN cn.name LIKE '%Targeted Population%' THEN LEFT(cv.name, 1) END), 'I') AS "Pop (13)",
    IFNULL(MAX(CASE WHEN cn.name LIKE '%HIV Test Result%' THEN LEFT(cv.name, 1) END), '-') AS "HIV Res (14)",
    
    /* TB */
    IFNULL(MAX(CASE WHEN cn.name LIKE '%Screened for TB%' AND cv.name = 'Yes' THEN '✓' END), 'N') AS "TB Screen (16)",
    IFNULL(MAX(CASE WHEN cn.name LIKE '%TB Screening Result%' THEN LEFT(cv.name, 1) END), '-') AS "TB Res (17)",
    IFNULL(MAX(CASE WHEN cn.name LIKE '%Type of diagnostic%' THEN LEFT(cv.name, 1) END), '6') AS "Diag Typ (18)",
    
    /* Referral & Remarks */
    IFNULL(MAX(CASE WHEN cn.name LIKE '%Referred%' THEN cv.name END), '-') AS "Ref (20)",
    IFNULL(MAX(CASE WHEN cn.name LIKE '%Died%' AND cv.name = 'Yes' THEN '✓' END), '-') AS "Died (21)",
    IFNULL(MAX(CASE WHEN cn.name = 'Remarks' THEN o.value_text END), '-') AS "Remark (23)"

FROM encounter e
JOIN patient pat ON e.patient_id = pat.patient_id AND pat.voided = 0
JOIN person p ON pat.patient_id = p.person_id
/* Variable initialization here to keep it as one statement */
CROSS JOIN (SELECT @row_number := 0) AS r
LEFT JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided = 0 AND pi.preferred = 1
LEFT JOIN person_address pa ON p.person_id = pa.person_id AND pa.voided = 0
LEFT JOIN obs o ON e.encounter_id = o.encounter_id AND o.voided = 0
LEFT JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.locale = 'en'
LEFT JOIN concept_name cv ON o.value_coded = cv.concept_id AND cv.concept_name_type = 'FULLY_SPECIFIED' AND cv.locale = 'en'
LEFT JOIN concept c_diag ON o.value_coded = c_diag.concept_id
LEFT JOIN concept_name cn_diag ON c_diag.concept_id = cn_diag.concept_id AND cn_diag.locale = 'en' AND cn_diag.concept_name_type = 'FULLY_SPECIFIED'

WHERE e.voided = 0
/* Broad filter: looks for any OPD or Consultation type encounter */
AND e.encounter_type IN (
    SELECT encounter_type_id FROM encounter_type 
    WHERE name REGEXP 'OPD|Consultation|Consultant|Outpatient|Medical|Registration'
)
AND CAST(e.encounter_datetime AS DATE) BETWEEN '#startDate#' AND '#endDate#'

GROUP BY e.encounter_id
ORDER BY e.encounter_datetime ASC;