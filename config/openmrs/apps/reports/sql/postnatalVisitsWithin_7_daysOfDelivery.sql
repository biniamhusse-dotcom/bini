-- Number of postnatal visits within 7 days of delivery

SELECT '24 Hrs (1day)' AS "Duration Stay", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62702 AND ob.value_coded = 62697 THEN 1 ELSE 0 END), 0) AS Count
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
SELECT '25 - 48 hrs (1 - 2 days)' AS "Duration Stay", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62702 AND ob.value_coded = 62698 THEN 1 ELSE 0 END), 0) AS Count
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
SELECT '49 - 72 hrs (2 - 3 days)' AS "Duration Stay", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62702 AND ob.value_coded = 62699 THEN 1 ELSE 0 END), 0) AS Count
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
SELECT '73 hrs - 7 days (4 - 7 days)' AS "Duration Stay", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62702 AND ob.value_coded = 62700 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';