SELECT 
  `Visit Location`, 
  `Payment Method`, 
  `Type of Credit`,
  `Patient Identifier`, 
  `Patient Name`, 
  `Gender`, 
  `Age`,
  `Address`,
  `Visit Date`
FROM (

  -- =========================================================
  -- 0. GRAND TOTAL OVERALL SUMMARY (APPEARS AT THE VERY TOP)
  -- =========================================================
  SELECT 
    '=== OVERALL SUMMARY ==='                                                AS "Visit Location",
    'ALL PAYMENT METHODS'                                                    AS "Payment Method",
    '-----'                                                                  AS "Type of Credit",
    'GRAND TOTAL'                                                            AS "Patient Identifier",
    CONCAT(COUNT(DISTINCT v.patient_id), ' Unique Patient(s), ', COUNT(DISTINCT v.visit_id), ' Total Visit(s)') AS "Patient Name",
    '-----'                                                                  AS "Gender",
    NULL                                                                     AS "Age",
    '-----'                                                                  AS "Address",
    NULL                                                                     AS "Visit Date",
    0                                                                        AS sort_order
  FROM visit v
  WHERE
    CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND v.voided = 0

  UNION ALL

  -- =========================================================
  -- 1. SUMMARY BREAKDOWN BY PAYMENT METHOD & CREDIT TYPE
  -- =========================================================
  SELECT 
    '=== SUMMARY BREAKDOWN ==='                                              AS "Visit Location",
    cn.name                                                                  AS "Payment Method",
    IF(cn.name LIKE '%Credit%', COALESCE(cn_credit.name, pa_credit.value, 'N/A'), '-----') AS "Type of Credit",
    '-- TOTAL --'                                                            AS "Patient Identifier",
    CONCAT(COUNT(DISTINCT v.patient_id), ' Unique Patient(s), ', COUNT(DISTINCT v.visit_id), ' Total Visit(s)') AS "Patient Name",
    '-----'                                                                  AS "Gender",
    NULL                                                                     AS "Age",
    '-----'                                                                  AS "Address",
    NULL                                                                     AS "Visit Date",
    1                                                                        AS sort_order
  FROM visit v
    JOIN person p ON p.person_id = v.patient_id AND p.voided = 0
    JOIN person_attribute pa ON p.person_id = pa.person_id AND pa.voided = 0
    JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name = 'PaymentMethod'
    LEFT JOIN concept_name cn ON pa.value = cn.concept_id AND cn.voided = 0 AND cn.concept_name_type = 'FULLY_SPECIFIED'
    
    -- Credit Type Attribute Join
    LEFT JOIN person_attribute pa_credit 
      ON p.person_id = pa_credit.person_id 
      AND pa_credit.voided = 0
      AND pa_credit.person_attribute_type_id = (SELECT person_attribute_type_id FROM person_attribute_type WHERE name = 'CreditType' LIMIT 1)
    LEFT JOIN concept_name cn_credit 
      ON pa_credit.value = cn_credit.concept_id AND cn_credit.voided = 0 AND cn_credit.concept_name_type = 'FULLY_SPECIFIED'

  WHERE
    CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND v.voided = 0
  GROUP BY 
    cn.name, 
    IF(cn.name LIKE '%Credit%', COALESCE(cn_credit.name, pa_credit.value, 'N/A'), '-----')

  UNION ALL

  -- =========================================================
  -- 2. DETAILED PATIENT ROWS
  -- =========================================================
  SELECT 
    l.name                                                                   AS "Visit Location",
    cn.name                                                                  AS "Payment Method",
    IF(cn.name LIKE '%Credit%', COALESCE(cn_credit.name, pa_credit.value, 'N/A'), '-----') AS "Type of Credit",
    pi.identifier                                                            AS "Patient Identifier",
    CONCAT(pn.given_name, ' ', IFNULL(pn.family_name, ''))                   AS "Patient Name",
    p.gender                                                                 AS "Gender",
    TIMESTAMPDIFF(YEAR, p.birthdate, v.date_created)                         AS "Age",
    CONCAT_WS(', ', pad.city_village, pad.county_district, pad.state_province) AS "Address",
    CAST(v.date_created AS DATE)                                             AS "Visit Date",
    2                                                                        AS sort_order
    
  FROM visit v
    JOIN person p ON p.person_id = v.patient_id AND p.voided = 0
    JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided = 0 AND pi.preferred = 1
    JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0 AND pn.preferred = 1
    JOIN location l ON v.location_id = l.location_id
    
    -- Primary Address Join
    LEFT JOIN person_address pad ON p.person_id = pad.person_id AND pad.voided = 0 AND pad.preferred = 1
    
    -- Payment Method Attribute Join
    JOIN person_attribute pa ON p.person_id = pa.person_id AND pa.voided = 0
    JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name = 'PaymentMethod'
    LEFT JOIN concept_name cn ON pa.value = cn.concept_id AND cn.voided = 0 AND cn.concept_name_type = 'FULLY_SPECIFIED'
    
    -- Credit Type Attribute Join
    LEFT JOIN person_attribute pa_credit 
      ON p.person_id = pa_credit.person_id 
      AND pa_credit.voided = 0
      AND pa_credit.person_attribute_type_id = (SELECT person_attribute_type_id FROM person_attribute_type WHERE name = 'CreditType' LIMIT 1)
    LEFT JOIN concept_name cn_credit 
      ON pa_credit.value = cn_credit.concept_id AND cn_credit.voided = 0 AND cn_credit.concept_name_type = 'FULLY_SPECIFIED'

  WHERE
    CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND v.voided = 0
    
UNION ALL
   
  -- =========================================================
  -- 3. SUBTOTAL ROWS PER LOCATION AND PAYMENT METHOD
  -- =========================================================
  SELECT 
    l.name                                                                   AS "Visit Location",
    cn.name                                                                  AS "Payment Method",
    '-----'                                                                  AS "Type of Credit",
    '-- SUBTOTAL --'                                                         AS "Patient Identifier",
    CONCAT(COUNT(DISTINCT v.patient_id), ' Patient(s), ', COUNT(DISTINCT v.visit_id), ' Visit(s)') AS "Patient Name",
    '-----'                                                                  AS "Gender",
    NULL                                                                     AS "Age",
    '-----'                                                                  AS "Address",
    NULL                                                                     AS "Visit Date",
    3                                                                        AS sort_order
    
  FROM visit v
    JOIN person p ON p.person_id = v.patient_id AND p.voided = 0
    JOIN location l ON v.location_id = l.location_id
    JOIN person_attribute pa ON p.person_id = pa.person_id AND pa.voided = 0
    JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name = 'PaymentMethod'
    LEFT JOIN concept_name cn ON pa.value = cn.concept_id AND cn.voided = 0 AND cn.concept_name_type = 'FULLY_SPECIFIED'
  WHERE
    CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND v.voided = 0
  GROUP BY 
    l.name, 
    cn.name
  
  UNION ALL

  -- =========================================================
  -- 4. COLUMN HEADERS (shown only when no data exists)
  -- =========================================================
  SELECT 
    NULL                                                                     AS "Visit Location",
    NULL                                                                     AS "Payment Method",
    NULL                                                                     AS "Type of Credit",
    NULL                                                                     AS "Patient Identifier",
    CONCAT('No records found for the selected date range (', '#startDate#', ' to ', '#endDate#', ')') AS "Patient Name",
    NULL                                                                     AS "Gender",
    NULL                                                                     AS "Age",
    NULL                                                                     AS "Address",
    NULL                                                                     AS "Visit Date",
    0                                                                        AS sort_order
  WHERE NOT EXISTS (
    SELECT 1 FROM visit v 
    WHERE CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#' 
    AND v.voided = 0
  )
    
) AS combined_report

-- =========================================================
-- MASTER SORTING LOGIC
-- =========================================================
ORDER BY 
  -- Force Grand Total (0) and Summary Breakdown (1) to the very top, no-data header first
  CASE 
    WHEN `Patient Identifier` IS NULL AND `Patient Name` LIKE 'No records%' THEN 0
    WHEN sort_order IN (0, 1) THEN sort_order 
    ELSE 2 
  END,
  
  -- Group the details and subtotals by Location and Payment Method
  `Visit Location` ASC, 
  `Payment Method` ASC, 
  
  -- Ensure patient details (2) come before their location subtotals (3)
  sort_order ASC, 
  
  -- Secondary sorts for clean presentation in the detailed lists
  `Type of Credit` ASC,
  `Patient Name` ASC,
  `Visit Date` DESC;