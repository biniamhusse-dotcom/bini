-- Number of cutaneous leishmaniasis patients treated by treatment outcome

SELECT 'Cured' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 57464 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Defaulted' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 10258 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Failed' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 10243 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT 'Dead' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 3164 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT 'Referred' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 2922 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';    