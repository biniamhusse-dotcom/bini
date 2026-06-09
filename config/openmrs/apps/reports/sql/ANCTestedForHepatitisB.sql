-- Total Number of Pregnant women attending antenatal care tested for hepatitis B

SELECT 'Number of pregnant women tested for hepatitis B (Reactive)' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 33777 AND ob.value_coded = 42793 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61490 OR o.value_coded = 61491) AND ob.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL    
SELECT 'Number of pregnant women tested for hepatitis B (Non-Reactive)' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 33777 AND ob.value_coded = 61542 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61490 OR o.value_coded = 61491) AND ob.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL    
SELECT 'Total Number of pregnant women who were received prophylaxis for HBV' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 61568 AND ob.value_coded = 1 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61490 OR o.value_coded = 61491) AND ob.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';