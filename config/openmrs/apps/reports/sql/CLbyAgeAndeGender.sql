-- Number of Cutaneous leishmaniasis patients treated by age and sex

SELECT '< 5 years, Male' AS "Age Group", 
    COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 5 AND ob.concept_id = 62333 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '< 5 years, Female' AS "Age Group", 
    COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 5 AND ob.concept_id = 62333 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '5 - 14 years, Male' AS "Age Group", 
    COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 5 AND 14 AND ob.concept_id = 62333 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '5 - 14 years, Female' AS "Age Group", 
    COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 5 AND 14 AND ob.concept_id = 	62333 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT '>= 15 years, Male' AS "Age Group", 
    COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 15 AND ob.concept_id = 62333 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT '>= 15 years, Female' AS "Age Group", 
    COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 15 AND ob.concept_id = 62333 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';