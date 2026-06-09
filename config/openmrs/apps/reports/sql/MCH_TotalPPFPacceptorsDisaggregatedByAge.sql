-- Total PPFP acceptors, disaggregated by age

SELECT '10 - 14 years' AS "Age Group", 
    COALESCE(SUM(CASE WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 10 AND 14 AND ob.concept_id = 62733 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '15 - 19 years' AS "Age Group", 
    COALESCE(SUM(CASE WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 15 AND 19 AND ob.concept_id = 62733 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '20 - 24 years' AS "Age Group", 
    COALESCE(SUM(CASE WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 20 AND 24 AND ob.concept_id = 62733 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '25 - 29 years' AS "Age Group", 
    COALESCE(SUM(CASE WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 25 AND 29 AND ob.concept_id = 62733 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '30 - 49 years' AS "Age Group", 
    COALESCE(SUM(CASE WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 30 AND 49 AND ob.concept_id = 62733 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 62840
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';