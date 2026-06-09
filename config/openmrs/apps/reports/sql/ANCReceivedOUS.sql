-- Total Number of pregnant women who received an obstetric ultrasound


SELECT 'Number of pregnant women who received an obstetric ultrasound before 20 weeks of gestation' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 13845 AND ob.value_numeric < 20 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
INNER JOIN orders ord ON ob.person_id = ord.patient_id AND ob.order_id = ord.order_id
WHERE 
    ord.concept_id = 67439
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL    
SELECT 'Number of pregnant women who received an obstetric ultrasound at or after 20 weeks of gestation' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 13845 AND ob.value_numeric >= 20 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
INNER JOIN orders ord ON ob.person_id = ord.patient_id AND ob.order_id = ord.order_id
WHERE 
    ord.concept_id = 67439
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';