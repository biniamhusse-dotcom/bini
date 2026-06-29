SELECT
  COALESCE(l.name, 'Unknown')                                             AS "Location",
  vt.name                                                                 AS "Service Unit",
  COUNT(DISTINCT v.patient_id)                                            AS "Number of Patient",
  ROUND(
    COUNT(DISTINCT v.patient_id) * 100.0 / 
    NULLIF((SELECT COUNT(DISTINCT v2.patient_id) 
            FROM visit v2 
            WHERE CAST(v2.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
            AND v2.voided = 0), 0)
  , 1)                                                                    AS "Percentage",
  MIN(CAST(v.date_created AS DATE))                                       AS "First Visit Date",
  MAX(CAST(v.date_created AS DATE))                                       AS "Last Visit Date"

FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  LEFT JOIN location l ON v.location_id = l.location_id

WHERE
  CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
  AND v.voided = 0

GROUP BY
  l.name,
  vt.name

UNION ALL

SELECT
  NULL                                                                     AS "Location",
  'GRAND TOTAL'                                                            AS "Service Unit",
  COUNT(DISTINCT v.patient_id)                                             AS "Number of Patient",
  100.0                                                                    AS "Percentage",
  MIN(CAST(v.date_created AS DATE))                                        AS "First Visit Date",
  MAX(CAST(v.date_created AS DATE))                                        AS "Last Visit Date"

FROM visit v
WHERE
  CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
  AND v.voided = 0

ORDER BY
  CASE WHEN `Service Unit` = 'GRAND TOTAL' THEN 1 ELSE 0 END,
  `Number of Patient` DESC,
  `Location` ASC,
  `Service Unit` ASC
