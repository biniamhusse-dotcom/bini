SELECT
    IFNULL(ob.value_text, 'Total') AS "Types of Case [Diagnoses]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 1 THEN 1 ELSE 0 END) AS "<1 yrs [M]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 1 AND 4 THEN 1 ELSE 0 END) AS "1-4 yrs [M]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 THEN 1 ELSE 0 END) AS "5-14 yrs [M]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15 AND 29 THEN 1 ELSE 0 END) AS "15-29 yrs [M]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 30 AND 64 THEN 1 ELSE 0 END) AS "30-64 yrs [M]",
    SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 65 THEN 1 ELSE 0 END) AS "65+ yrs [M]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 1 THEN 1 ELSE 0 END) AS "<1 yrs [F]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 1 AND 4 THEN 1 ELSE 0 END) AS "1-4 yrs [F]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 THEN 1 ELSE 0 END) AS "5-14 yrs [F]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15 AND 29 THEN 1 ELSE 0 END) AS "15-29 yrs [F]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 30 AND 64 THEN 1 ELSE 0 END) AS "30-64 yrs [F]",
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 65 THEN 1 ELSE 0 END) AS "65+ yrs [F]",
    COUNT(*) AS "Total"
FROM
    person p
    JOIN obs ob ON ob.person_id = p.person_id
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
    JOIN concept c ON ob.concept_id = c.concept_id AND ob.voided = 0
    AND c.concept_id = 21
WHERE
    EXISTS (
        SELECT
            1
        FROM
            obs o
        WHERE
            o.encounter_id = ob.encounter_id
            AND o.value_coded = 67028 AND o.voided = 0
    )
    AND EXISTS (
        SELECT
            1
        FROM
            obs o
        WHERE
            o.encounter_id = ob.encounter_id
            AND o.value_coded = 28 AND o.voided = 0
    )
    AND ob.location_id IN(159, 160, 161, 162, 163, 164,165, 166, 167, 168)
GROUP BY
    ob.value_text 
WITH ROLLUP;