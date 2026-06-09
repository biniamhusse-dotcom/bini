SELECT 
    name AS "Condition / Screening Result",
    SUM(CASE WHEN gender = 'M' AND age < 18 THEN 1 ELSE 0 END) AS "<18 yrs [M]",
    SUM(CASE WHEN gender = 'M' AND age BETWEEN 18 AND 29 THEN 1 ELSE 0 END) AS "18-29 yrs [M]",
    SUM(CASE WHEN gender = 'M' AND age BETWEEN 30 AND 39 THEN 1 ELSE 0 END) AS "30-39 yrs [M]",
    SUM(CASE WHEN gender = 'M' AND age BETWEEN 40 AND 64 THEN 1 ELSE 0 END) AS "40-64 yrs [M]",
    SUM(CASE WHEN gender = 'M' AND age >= 65 THEN 1 ELSE 0 END) AS "65+ yrs [M]",
    SUM(CASE WHEN gender = 'F' AND age < 18 THEN 1 ELSE 0 END) AS "<18 yrs [F]",
    SUM(CASE WHEN gender = 'F' AND age BETWEEN 18 AND 29 THEN 1 ELSE 0 END) AS "18-29 yrs [F]",
    SUM(CASE WHEN gender = 'F' AND age BETWEEN 30 AND 39 THEN 1 ELSE 0 END) AS "30-39 yrs [F]",
    SUM(CASE WHEN gender = 'F' AND age BETWEEN 40 AND 64 THEN 1 ELSE 0 END) AS "40-64 yrs [F]",
    SUM(CASE WHEN gender = 'F' AND age >= 65 THEN 1 ELSE 0 END) AS "65+ yrs [F]",
    COUNT(*) AS "Total Screened"
FROM (
    -- PART 0: Total Patients
    SELECT 'Total Patients Visited' as name, p.gender, TIMESTAMPDIFF(YEAR, p.birthdate, o.obs_datetime) AS age
    FROM obs o JOIN person p ON o.person_id = p.person_id
    WHERE o.voided = 0 AND o.concept_id IN (61013, 61133)
      AND DATE(o.obs_datetime) BETWEEN '#startDate#' AND '#endDate#'
    GROUP BY p.person_id 

    UNION ALL

    -- PART 1: DM Screening
    SELECT 
        CASE WHEN res.value_numeric >= 126 THEN 'DM Screening (Result: RAISED)' ELSE 'DM Screening (Result: NORMAL)' END,
        p.gender, TIMESTAMPDIFF(YEAR, p.birthdate, scr.obs_datetime) AS age
    FROM obs scr
    JOIN person p ON scr.person_id = p.person_id
    JOIN obs res ON scr.encounter_id = res.encounter_id AND res.concept_id = 67977 AND res.voided = 0
    WHERE scr.voided = 0 AND scr.concept_id = 67976
      AND (scr.value_numeric = 1 OR scr.value_coded = 1065) -- Handles both Boolean and Coded Yes
      AND DATE(scr.obs_datetime) BETWEEN '#startDate#' AND '#endDate#'

    UNION ALL

    -- PART 2: HTN Screening
    SELECT 
        CASE WHEN (MAX(CASE WHEN v.concept_id = 8881 THEN v.value_numeric END) >= 140 
               OR MAX(CASE WHEN v.concept_id = 8830 THEN v.value_numeric END) >= 90) 
            THEN 'HTN Screening (Result: RAISED)' ELSE 'HTN Screening (Result: NORMAL)' END,
        p.gender, TIMESTAMPDIFF(YEAR, p.birthdate, v.obs_datetime) AS age
    FROM obs v JOIN person p ON v.person_id = p.person_id
    WHERE v.voided = 0 AND v.concept_id IN (8881, 8830)
      AND DATE(v.obs_datetime) BETWEEN '#startDate#' AND '#endDate#'
    GROUP BY v.encounter_id 
) AS combined_data
GROUP BY name
ORDER BY (CASE WHEN name = 'Total Patients Visited' THEN 0 ELSE 1 END), name;