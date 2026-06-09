SELECT 
    t.Diagnosis AS "Types of Case",
    t.m1 AS "<1 yrs [M]", 
    t.m2 AS "1-4 yrs [M]", 
    t.m3 AS "5-14 yrs [M]", 
    t.m4 AS "15-29 yrs [M]", 
    t.m5 AS "30-64 yrs [M]", 
    t.m6 AS "65+ yrs[M]",
    t.f1 AS "<1 yrs [F]", 
    t.f2 AS "1-4 yrs [F]", 
    t.f3 AS "5-14 yrs [F]", 
    t.f4 AS "15-29 yrs [F]", 
    t.f5 AS "30-64 yrs [F]", 
    t.f6 AS "65+ yrs [F]",
    t.Total AS "Total"
FROM (
    SELECT
        IFNULL(cn.name, 'Uncoded Diagnosis') AS Diagnosis,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) < 1, 1, 0)) AS m1,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 1 AND 4, 1, 0)) AS m2,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 5 AND 14, 1, 0)) AS m3,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 15 AND 29, 1, 0)) AS m4,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 30 AND 64, 1, 0)) AS m5,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) >= 65, 1, 0)) AS m6,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) < 1, 1, 0)) AS f1,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 1 AND 4, 1, 0)) AS f2,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 5 AND 14, 1, 0)) AS f3,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 15 AND 29, 1, 0)) AS f4,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 30 AND 64, 1, 0)) AS f5,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) >= 65, 1, 0)) AS f6,
        COUNT(ob.obs_id) AS Total
    FROM person p
    JOIN obs ob ON p.person_id = ob.person_id AND ob.voided = 0
    JOIN concept c ON ob.value_coded = c.concept_id AND c.class_id = 4
    JOIN obs status ON status.encounter_id = ob.encounter_id AND status.value_coded = 28 AND status.voided = 0
    LEFT JOIN concept_name cn ON cn.concept_id = ob.value_coded AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.locale = 'en' AND cn.voided = 0
    WHERE cast(ob.obs_datetime as date) BETWEEN '#startDate#' AND '#endDate#'
    GROUP BY ob.value_coded, cn.name
) AS t

UNION ALL

SELECT 
    "Total",
    SUM(s.m1), SUM(s.m2), SUM(s.m3), SUM(s.m4), SUM(s.m5), SUM(s.m6),
    SUM(s.f1), SUM(s.f2), SUM(s.f3), SUM(s.f4), SUM(s.f5), SUM(s.f6),
    SUM(s.Total)
FROM (
    SELECT
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) < 1, 1, 0)) AS m1,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 1 AND 4, 1, 0)) AS m2,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 5 AND 14, 1, 0)) AS m3,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 15 AND 29, 1, 0)) AS m4,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 30 AND 64, 1, 0)) AS m5,
        SUM(IF(p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) >= 65, 1, 0)) AS m6,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) < 1, 1, 0)) AS f1,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 1 AND 4, 1, 0)) AS f2,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 5 AND 14, 1, 0)) AS f3,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 15 AND 29, 1, 0)) AS f4,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) BETWEEN 30 AND 64, 1, 0)) AS f5,
        SUM(IF(p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.obs_datetime) >= 65, 1, 0)) AS f6,
        COUNT(ob.obs_id) AS Total
    FROM person p
    JOIN obs ob ON p.person_id = ob.person_id AND ob.voided = 0
    JOIN concept c ON ob.value_coded = c.concept_id AND c.class_id = 4
    JOIN obs status ON status.encounter_id = ob.encounter_id AND status.value_coded = 28 AND status.voided = 0
    WHERE cast(ob.obs_datetime as date) BETWEEN '#startDate#' AND '#endDate#'
) AS s