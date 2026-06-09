SELECT
    IFNULL(cn.name, 'Total') AS "Types of Case [Diagnoses]",
    -- Male age groups
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 1 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "<1 yrs [M, N]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 1 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "<1 yrs [M, R]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 1 AND 4 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "1-4 yrs [M, N]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 1 AND 4 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "1-4 yrs [M, R]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "5-14 yrs [M, N]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "5-14 yrs [M, R]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15 AND 29 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "15-29 yrs [M, N]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15 AND 29 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "15-29 yrs [M, R])",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 30 AND 64 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "30-64 yrs [M, N]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 30 AND 64 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "30-64 yrs [M, R])",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 65 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "65+ yrs [M, N]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 65 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "65+ yrs [M, R]",

    -- Female age groups
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 1 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "<1 yrs [F, N]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 1 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "<1 yrs [F, R]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 1 AND 4 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "1-4 yrs [F, N]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 1 AND 4 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "1-4 yrs [F, R]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "5-14 yrs [F, N]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "5-14 yrs [F, R]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15 AND 29 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "15-29 yrs [F, N]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15 AND 29 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "15-29 yrs [F, R]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 30 AND 64 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "30-64 yrs [F, N]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 30 AND 64 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "30-64 yrs [F, R]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 65 AND o.value_coded = 67028 THEN 1 ELSE 0 END) AS "65+ yrs [F, N]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 65 AND o.value_coded = 67029 THEN 1 ELSE 0 END) AS "65+ yrs [F, R]",

    COUNT(*) AS "Total"
FROM 
    person p
JOIN 
    obs ob ON ob.person_id = p.person_id AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
JOIN 
    concept c ON ob.value_coded = c.concept_id AND c.class_id = 4 AND ob.voided = 0
JOIN 
    concept_name cn ON cn.concept_id = ob.value_coded AND cn.concept_name_type = "FULLY_SPECIFIED"
JOIN 
    obs o ON o.encounter_id = ob.encounter_id AND (o.value_coded = 67028 OR o.value_coded = 67029) AND o.voided = 0
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.value_coded = 28 AND o.voided = 0
    )
GROUP BY 
    cn.name
WITH ROLLUP;
