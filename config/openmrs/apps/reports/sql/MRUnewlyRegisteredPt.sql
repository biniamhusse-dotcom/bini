SELECT 
  `Patient Identifier`, 
  `Full Name`, 
  `Gender`, 
  `Age`,
  `Address`,
  `Visit Location`, 
  `Payment Method`, 
  `Type of Credit`,
  `Registration Date`,
  `Visit Date`
FROM (

  -- =========================================================
  -- 0. GRAND TOTAL OVERALL SUMMARY (NEW PATIENTS ONLY)
  -- =========================================================
  SELECT 
    '=== OVERALL SUMMARY ==='                                                AS "Visit Location",
    'ALL PAYMENT METHODS'                                                    AS "Payment Method",
    '-----'                                                                  AS "Type of Credit",
    'GRAND TOTAL (NEW REGISTRATIONS)'                                        AS "Patient Identifier",
    CONCAT(COUNT(DISTINCT v.patient_id), ' Unique Patient(s), ', COUNT(DISTINCT v.visit_id), ' Total Visit(s)') AS "Full Name",
    '-----'                                                                  AS "Gender",
    NULL                                                                     AS "Age",
    '-----'                                                                  AS "Address",
    NULL                                                                     AS "Registration Date",
    NULL                                                                     AS "Visit Date",
    0                                                                        AS sort_order
  FROM visit v
    JOIN person p ON p.person_id = v.patient_id AND p.voided = 0
  WHERE
    CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND CAST(p.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
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
    CONCAT(COUNT(DISTINCT v.patient_id), ' Unique Patient(s), ', COUNT(DISTINCT v.visit_id), ' Total Visit(s)') AS "Full Name",
    '-----'                                                                  AS "Gender",
    NULL                                                                     AS "Age",
    '-----'                                                                  AS "Address",
    NULL                                                                     AS "Registration Date",
    NULL                                                                     AS "Visit Date",
    1                                                                        AS sort_order
  FROM visit v
    JOIN person p ON p.person_id = v.patient_id AND p.voided = 0
    JOIN person_attribute pa ON p.person_id = pa.person_id AND pa.voided = 0
    JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name = 'PaymentMethod'
    LEFT JOIN concept_name cn ON pa.value = cn.concept_id AND cn.voided = 0 AND cn.concept_name_type = 'FULLY_SPECIFIED'
    
    LEFT JOIN person_attribute pa_credit 
      ON p.person_id = pa_credit.person_id 
      AND pa_credit.voided = 0
      AND pa_credit.person_attribute_type_id = (SELECT person_attribute_type_id FROM person_attribute_type WHERE name = 'CreditType' LIMIT 1)
    LEFT JOIN concept_name cn_credit 
      ON pa_credit.value = cn_credit.concept_id AND cn_credit.voided = 0 AND cn_credit.concept_name_type = 'FULLY_SPECIFIED'

  WHERE
    CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND CAST(p.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND v.voided = 0
  GROUP BY 
    cn.name, 
    IF(cn.name LIKE '%Credit%', COALESCE(cn_credit.name, pa_credit.value, 'N/A'), '-----')

  UNION ALL

  -- =========================================================
  -- 2. DETAILED PATIENT ROWS (WITH ETHIOPIAN CALENDAR MATH)
  -- =========================================================
  SELECT 
    l.name                                                                   AS "Visit Location",
    cn.name                                                                  AS "Payment Method",
    IF(cn.name LIKE '%Credit%', COALESCE(cn_credit.name, pa_credit.value, 'N/A'), '-----') AS "Type of Credit",
    pi.identifier                                                            AS "Patient Identifier",
    CONCAT_WS(' ', pn.given_name, pn.middle_name, pn.family_name)            AS "Full Name",
    p.gender                                                                 AS "Gender",
    TIMESTAMPDIFF(YEAR, p.birthdate, v.date_created)                         AS "Age",
    CONCAT_WS(', ', pad.city_village, pad.county_district, pad.state_province) AS "Address",
    
    -- Convert Registration Date to Ethiopian Calendar (YYYY-MM-DD)
    CONCAT(
      IF(DATE(p.date_created) >= DATE(CONCAT(YEAR(p.date_created), '-09-', 11 + IF(YEAR(p.date_created) % 4 = 3, 1, 0))), YEAR(p.date_created) - 7, YEAR(p.date_created) - 8), '-',
      LPAD(FLOOR(DATEDIFF(p.date_created, IF(DATE(p.date_created) >= DATE(CONCAT(YEAR(p.date_created), '-09-', 11 + IF(YEAR(p.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(p.date_created), '-09-', 11 + IF(YEAR(p.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(p.date_created) - 1, '-09-', 11 + IF((YEAR(p.date_created) - 1) % 4 = 3, 1, 0))))) / 30) + 1, 2, '0'), '-',
      LPAD((DATEDIFF(p.date_created, IF(DATE(p.date_created) >= DATE(CONCAT(YEAR(p.date_created), '-09-', 11 + IF(YEAR(p.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(p.date_created), '-09-', 11 + IF(YEAR(p.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(p.date_created) - 1, '-09-', 11 + IF((YEAR(p.date_created) - 1) % 4 = 3, 1, 0))))) % 30) + 1, 2, '0')
    ) AS "Registration Date",

    -- Convert Visit Date to Ethiopian Calendar (YYYY-MM-DD)
    CONCAT(
      IF(DATE(v.date_created) >= DATE(CONCAT(YEAR(v.date_created), '-09-', 11 + IF(YEAR(v.date_created) % 4 = 3, 1, 0))), YEAR(v.date_created) - 7, YEAR(v.date_created) - 8), '-',
      LPAD(FLOOR(DATEDIFF(v.date_created, IF(DATE(v.date_created) >= DATE(CONCAT(YEAR(v.date_created), '-09-', 11 + IF(YEAR(v.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(v.date_created), '-09-', 11 + IF(YEAR(v.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(v.date_created) - 1, '-09-', 11 + IF((YEAR(v.date_created) - 1) % 4 = 3, 1, 0))))) / 30) + 1, 2, '0'), '-',
      LPAD((DATEDIFF(v.date_created, IF(DATE(v.date_created) >= DATE(CONCAT(YEAR(v.date_created), '-09-', 11 + IF(YEAR(v.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(v.date_created), '-09-', 11 + IF(YEAR(v.date_created) % 4 = 3, 1, 0))), DATE(CONCAT(YEAR(v.date_created) - 1, '-09-', 11 + IF((YEAR(v.date_created) - 1) % 4 = 3, 1, 0))))) % 30) + 1, 2, '0')
    ) AS "Visit Date",
    
    2 AS sort_order
    
  FROM visit v
    JOIN person p ON p.person_id = v.patient_id AND p.voided = 0
    JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided = 0 AND pi.preferred = 1
    JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0 AND pn.preferred = 1
    JOIN location l ON v.location_id = l.location_id
    
    LEFT JOIN person_address pad ON p.person_id = pad.person_id AND pad.voided = 0 AND pad.preferred = 1
    
    JOIN person_attribute pa ON p.person_id = pa.person_id AND pa.voided = 0
    JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name = 'PaymentMethod'
    LEFT JOIN concept_name cn ON pa.value = cn.concept_id AND cn.voided = 0 AND cn.concept_name_type = 'FULLY_SPECIFIED'
    
    LEFT JOIN person_attribute pa_credit 
      ON p.person_id = pa_credit.person_id 
      AND pa_credit.voided = 0
      AND pa_credit.person_attribute_type_id = (SELECT person_attribute_type_id FROM person_attribute_type WHERE name = 'CreditType' LIMIT 1)
    LEFT JOIN concept_name cn_credit 
      ON pa_credit.value = cn_credit.concept_id AND cn_credit.voided = 0 AND cn_credit.concept_name_type = 'FULLY_SPECIFIED'

  WHERE
    CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND CAST(p.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
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
    CONCAT(COUNT(DISTINCT v.patient_id), ' Patient(s), ', COUNT(DISTINCT v.visit_id), ' Visit(s)') AS "Full Name",
    '-----'                                                                  AS "Gender",
    NULL                                                                     AS "Age",
    '-----'                                                                  AS "Address",
    NULL                                                                     AS "Registration Date",
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
    AND CAST(p.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    AND v.voided = 0
  GROUP BY 
    l.name, 
    cn.name
    
) AS combined_report

-- =========================================================
-- MASTER SORTING LOGIC
-- =========================================================
ORDER BY 
  CASE WHEN sort_order IN (0, 1) THEN sort_order ELSE 2 END,
  `Visit Location` ASC, 
  `Payment Method` ASC, 
  sort_order ASC, 
  `Type of Credit` ASC,
  `Registration Date` DESC,
  `Full Name` ASC;