-- Total PPFP acceptors, disaggregated by method

SELECT 'Pills (POP)' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 62676 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Implants' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 10077 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'IUCD' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 62687 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Tubal ligation' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 61786 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT 'Others' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 2143 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';