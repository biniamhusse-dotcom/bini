-- Total PPFP acceptors, disaggregated by Uterotonics Received

SELECT 'Oxytocin' AS "Uterotonics Received", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 61918 AND ob.value_coded = 67943 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 	62925
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Ergometrine' AS "Uterotonics Received", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 61918 AND ob.value_coded = 67944 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62925
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Misoprostol' AS "Uterotonics Received", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 61918 AND ob.value_coded = 67945 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62925
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Carbetocin' AS "Uterotonics Received", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 61918 AND ob.value_coded = 67946 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62925
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT 'Others' AS "Uterotonics Received", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 61918 AND ob.value_coded = 64632 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62925
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';