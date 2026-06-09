-- Total number of Pregnant women received IFA at least 90 plus

SELECT 'Number of Pregnant women received IFA at least 90 plus (10 - 14 Years)' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 10 AND 14 AND ob.concept_id = 63685 AND ob.value_coded = 1 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61490 OR o.value_coded = 61491) AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Number of Pregnant women received IFA at least 90 plus (15 - 19 Years)' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 15 AND 19 AND ob.concept_id = 63685 AND ob.value_coded = 1 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61490 OR o.value_coded = 61491) AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Number of Pregnant women received IFA at least 90 plus (>= 20 Years)' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 20 AND ob.concept_id = 63685 AND ob.value_coded = 1 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61490 OR o.value_coded = 61491) AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';