-- Number of women receiving comprehensive abortion care disaggregated by trimester

SELECT '1st trimester (<12 weeks)' AS "Trimester", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND (ob.value_coded = 61785 OR ob.value_coded = 61785) THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.value_numeric < 12
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '2nd trimester (>=12 - 28 weeks)' AS "Trimester", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND (ob.value_coded = 61785 OR ob.value_coded = 61785) THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.value_numeric >= 12
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';