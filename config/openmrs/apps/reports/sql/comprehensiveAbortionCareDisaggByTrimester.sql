-- Number of women receiving comprehensive abortion care disaggregated by trimester

SELECT '1st trimester (<12 weeks)' AS Trimester, 
    SUM(CASE WHEN ob.concept_id = 60884 AND ob.value_numeric = 	61484 THEN 1 ELSE 0 END) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id 
            AND o.concept_id = 	61143 AND o.value_coded = 30
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '2nd trimester (>=12 - 28 weeks)' AS Method, 
    SUM(CASE WHEN ob.concept_id = 60884 AND ob.value_numeric = 	61484 THEN 1 ELSE 0 END) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id 
            AND o.concept_id = 	61143 AND o.value_coded = 30
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'