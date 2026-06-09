SELECT 
    final.Diagnosis AS "Types of Case",
    final.location_name AS "Visit Location",
    final.m1 AS "<1 yrs [M]", 
    final.m2 AS "1-4 yrs [M]", 
    final.m3 AS "5-14 yrs [M]", 
    final.m4 AS "15-29 yrs [M]", 
    final.m5 AS "30-64 yrs [M]", 
    final.m6 AS "65+ yrs[M]",
    final.f1 AS "<1 yrs [F]", 
    final.f2 AS "1-4 yrs [F]", 
    final.f3 AS "5-14 yrs [F]", 
    final.f4 AS "15-29 yrs [F]", 
    final.f5 AS "30-64 yrs [F]", 
    final.f6 AS "65+ yrs [F]",
    final.Total AS "Total"
FROM (
    -- 1. INDIVIDUAL DIAGNOSIS ROWS
    SELECT
        1 AS sort_weight,
        l.name AS group_location,
        IFNULL(cn.name, 'Uncoded Diagnosis') AS Diagnosis,
        l.name AS location_name,
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
    JOIN encounter e ON ob.encounter_id = e.encounter_id AND e.voided = 0
    JOIN location l ON e.location_id = l.location_id
    JOIN concept c ON ob.value_coded = c.concept_id AND c.class_id = 4
    JOIN obs status ON status.encounter_id = ob.encounter_id AND status.value_coded = 28 AND status.voided = 0
    LEFT JOIN concept_name cn ON cn.concept_id = ob.value_coded AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.locale = 'en' AND cn.voided = 0
    WHERE cast(ob.obs_datetime as date) BETWEEN '#startDate#' AND '#endDate#'
    GROUP BY l.name, ob.value_coded, cn.name

    UNION ALL

    -- 2. SUB-TOTAL ROWS FOR EACH LOCATION
    SELECT
        2 AS sort_weight,
        l.name AS group_location,
        CONCAT('<b><font size="4">SUB-TOTAL: ', l.name, '</font></b>') AS Diagnosis,
        '' AS location_name,
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
    JOIN encounter e ON ob.encounter_id = e.encounter_id AND e.voided = 0
    JOIN location l ON e.location_id = l.location_id
    JOIN concept c ON ob.value_coded = c.concept_id AND c.class_id = 4
    JOIN obs status ON status.encounter_id = ob.encounter_id AND status.value_coded = 28 AND status.voided = 0
    WHERE cast(ob.obs_datetime as date) BETWEEN '#startDate#' AND '#endDate#'
    GROUP BY l.name

    UNION ALL

    -- 3. GRAND TOTAL ROW
    SELECT 
        3 AS sort_weight,
        'ZZZZZ' AS group_location, -- High value to keep it at the very bottom
        '<b><font size="5">GRAND TOTAL</font></b>' AS Diagnosis,
        '' AS location_name,
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
) AS final
ORDER BY 
    final.group_location ASC, -- Keep location data together
    final.sort_weight ASC,     -- Show detail (1) then subtotal (2)
    final.Diagnosis ASC;       -- Sort diagnosis alphabetically within details