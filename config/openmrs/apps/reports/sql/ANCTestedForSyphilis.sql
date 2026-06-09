-- Total Number of pregnant women tested for syphilis

SELECT 'Number of pregnant women tested for syphilis (Reactive)' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 11004 AND ob.value_coded = 42793 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61499 OR o.value_coded = 61491) AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL    
SELECT 'Number of pregnant women tested for syphilis (Non-Reactive)' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 11004 AND ob.value_coded = 61542 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 261486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61499 OR o.value_coded = 61491) AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL    
SELECT 'Total Number of pregnant women treated for syphilis' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.concept_id = 61567 AND ob.value_coded = 1 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 261486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61499 OR o.value_coded = 61491) AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';