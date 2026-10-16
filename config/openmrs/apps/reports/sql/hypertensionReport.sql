SELECT
    labels.Activity AS "Activity",
    CASE labels.sort_order
        WHEN 1  THEN t.triaged_total
        WHEN 2  THEN t.em_triaged
        WHEN 3  THEN t.central_triaged
        WHEN 4  THEN NULL
        WHEN 5  THEN h.htn_total
        WHEN 6  THEN h.htn_18_29_m
        WHEN 7  THEN h.htn_18_29_f
        WHEN 8  THEN h.htn_30_39_m
        WHEN 9  THEN h.htn_30_39_f
        WHEN 10 THEN h.htn_40_69_m
        WHEN 11 THEN h.htn_40_69_f
        WHEN 12 THEN h.htn_70_m
        WHEN 13 THEN h.htn_70_f
        WHEN 14 THEN h.htn_total
        WHEN 15 THEN h.htn_raised
        WHEN 16 THEN h.htn_normal
        WHEN 17 THEN CASE WHEN t.triaged_total > 0
                          THEN CAST(ROUND(h.htn_total * 100 / t.triaged_total) AS UNSIGNED)
                          ELSE 0 END
        WHEN 18 THEN NULL
        WHEN 19 THEN d.dm_total
        WHEN 20 THEN d.dm_lt40_m
        WHEN 21 THEN d.dm_lt40_f
        WHEN 22 THEN d.dm_ge40_m
        WHEN 23 THEN d.dm_ge40_f
        WHEN 24 THEN d.dm_total
        WHEN 25 THEN d.dm_raised
        WHEN 26 THEN d.dm_normal
        WHEN 27 THEN CASE WHEN t.triaged_total > 0
                          THEN CAST(ROUND(d.dm_total * 100 / t.triaged_total) AS UNSIGNED)
                          ELSE 0 END
    END AS "Number"
FROM (
    SELECT 1 AS sort_order, 'Total triaged patients' AS Activity
    UNION ALL SELECT 2,  'Triaged patients - EM (Emergency) Triage'
    UNION ALL SELECT 3,  'Triaged patients - Central Triage'
    UNION ALL SELECT 4,  'Hypertension'
    UNION ALL SELECT 5,  'Number of Individuals screened for hypertension'
    UNION ALL SELECT 6,  '18 - 29 Years, Male'
    UNION ALL SELECT 7,  '18 - 29 Years, Female'
    UNION ALL SELECT 8,  '30 - 39 Years, Male'
    UNION ALL SELECT 9,  '30 - 39 Years, Female'
    UNION ALL SELECT 10, '40 - 69 Years, Male'
    UNION ALL SELECT 11, '40 - 69 Years, Female'
    UNION ALL SELECT 12, '>=70 Years, Male'
    UNION ALL SELECT 13, '>=70 Years, Female'
    UNION ALL SELECT 14, 'Number of Individuals screened for hypertension by result of screening'
    UNION ALL SELECT 15, 'Raised BP'
    UNION ALL SELECT 16, 'Normal BP'
    UNION ALL SELECT 17, 'Percent of results recorded from total triaged patients'
    UNION ALL SELECT 18, 'Diabetes mellitus'
    UNION ALL SELECT 19, 'Individuals screened for Diabetes Mellitus by age and sex'
    UNION ALL SELECT 20, '< 40 Years, Male'
    UNION ALL SELECT 21, '< 40 Years, Female'
    UNION ALL SELECT 22, '>= 40 Years, Male'
    UNION ALL SELECT 23, '>= 40 Years, Female'
    UNION ALL SELECT 24, 'Number of Individuals screened for Diabetes Mellitus by result of screening'
    UNION ALL SELECT 25, 'Raised blood Sugar'
    UNION ALL SELECT 26, 'Normal blood Sugar'
    UNION ALL SELECT 27, 'Percent of results recorded from total triaged patients'
) labels
CROSS JOIN (
    SELECT
        COUNT(DISTINCT CASE WHEN htn.age >= 18 THEN htn.person_id END) AS htn_total,
        COUNT(DISTINCT CASE WHEN htn.gender = 'M' AND htn.age BETWEEN 18 AND 29 THEN htn.person_id END) AS htn_18_29_m,
        COUNT(DISTINCT CASE WHEN htn.gender = 'F' AND htn.age BETWEEN 18 AND 29 THEN htn.person_id END) AS htn_18_29_f,
        COUNT(DISTINCT CASE WHEN htn.gender = 'M' AND htn.age BETWEEN 30 AND 39 THEN htn.person_id END) AS htn_30_39_m,
        COUNT(DISTINCT CASE WHEN htn.gender = 'F' AND htn.age BETWEEN 30 AND 39 THEN htn.person_id END) AS htn_30_39_f,
        COUNT(DISTINCT CASE WHEN htn.gender = 'M' AND htn.age BETWEEN 40 AND 69 THEN htn.person_id END) AS htn_40_69_m,
        COUNT(DISTINCT CASE WHEN htn.gender = 'F' AND htn.age BETWEEN 40 AND 69 THEN htn.person_id END) AS htn_40_69_f,
        COUNT(DISTINCT CASE WHEN htn.gender = 'M' AND htn.age >= 70 THEN htn.person_id END) AS htn_70_m,
        COUNT(DISTINCT CASE WHEN htn.gender = 'F' AND htn.age >= 70 THEN htn.person_id END) AS htn_70_f,
        COUNT(DISTINCT CASE WHEN htn.max_sbp >= 140 OR htn.max_dbp >= 90 THEN htn.person_id END) AS htn_raised,
        COUNT(DISTINCT CASE WHEN htn.age >= 18 THEN htn.person_id END)
            - COUNT(DISTINCT CASE WHEN htn.max_sbp >= 140 OR htn.max_dbp >= 90 THEN htn.person_id END) AS htn_normal
    FROM (
        -- Hypertension screening: BP values recorded, seen on Central Triage / ED Triage forms.
        -- Patients with no BP value recorded are excluded from the report.
        SELECT v.person_id,
               p.gender,
               TIMESTAMPDIFF(YEAR, p.birthdate, MIN(v.obs_datetime)) AS age,
               MAX(CASE WHEN v.concept_id = 8881 THEN v.value_numeric END) AS max_sbp,
               MAX(CASE WHEN v.concept_id = 8830 THEN v.value_numeric END) AS max_dbp
        FROM obs v
        JOIN person p ON p.person_id = v.person_id
        WHERE v.voided = 0
          AND v.concept_id IN (8881, 8830)
          AND DATE(v.obs_datetime) BETWEEN '#startDate#' AND '#endDate#'
          AND EXISTS (SELECT 1 FROM obs f
                      WHERE f.voided = 0 AND f.concept_id IN (61017, 61133)
                        AND f.person_id = v.person_id
                        AND DATE(f.obs_datetime) BETWEEN '#startDate#' AND '#endDate#')
        GROUP BY v.person_id, p.gender, p.birthdate
        HAVING age >= 18
           AND (max_sbp IS NOT NULL OR max_dbp IS NOT NULL)
    ) htn
) h
CROSS JOIN (
    SELECT
        COUNT(DISTINCT dm.person_id) AS dm_total,
        COUNT(DISTINCT CASE WHEN dm.gender = 'M' AND dm.age < 40 THEN dm.person_id END) AS dm_lt40_m,
        COUNT(DISTINCT CASE WHEN dm.gender = 'F' AND dm.age < 40 THEN dm.person_id END) AS dm_lt40_f,
        COUNT(DISTINCT CASE WHEN dm.gender = 'M' AND dm.age >= 40 THEN dm.person_id END) AS dm_ge40_m,
        COUNT(DISTINCT CASE WHEN dm.gender = 'F' AND dm.age >= 40 THEN dm.person_id END) AS dm_ge40_f,
        COUNT(DISTINCT CASE WHEN dm.max_glucose >= 126 THEN dm.person_id END) AS dm_raised,
        COUNT(DISTINCT dm.person_id)
            - COUNT(DISTINCT CASE WHEN dm.max_glucose >= 126 THEN dm.person_id END) AS dm_normal
    FROM (
        -- Diabetes screening: screened = Yes AND a result value exists, seen on Central Triage / ED Triage forms.
        -- Patients screened with no recorded result are excluded from the report.
        SELECT scr.person_id,
               p.gender,
               TIMESTAMPDIFF(YEAR, p.birthdate, MIN(scr.obs_datetime)) AS age,
               MAX(res.value_numeric) AS max_glucose
        FROM obs scr
        JOIN person p ON p.person_id = scr.person_id
        LEFT JOIN (
            SELECT encounter_id, MAX(value_numeric) AS value_numeric
            FROM obs
            WHERE concept_id = 67977 AND voided = 0
            GROUP BY encounter_id
        ) res ON res.encounter_id = scr.encounter_id
        WHERE scr.voided = 0
          AND scr.concept_id = 67976
          AND (scr.value_numeric = 1
               OR scr.value_coded IN (SELECT concept_id FROM concept_name
                                      WHERE name IN ('Yes','True') AND locale = 'en' AND voided = 0))
          AND DATE(scr.obs_datetime) BETWEEN '#startDate#' AND '#endDate#'
          AND EXISTS (SELECT 1 FROM obs f
                      WHERE f.voided = 0 AND f.concept_id IN (61017, 61133)
                        AND f.person_id = scr.person_id
                        AND DATE(f.obs_datetime) BETWEEN '#startDate#' AND '#endDate#')
        GROUP BY scr.person_id, p.gender, p.birthdate
        HAVING max_glucose IS NOT NULL
    ) dm
) d
CROSS JOIN (
    -- Triaged patients: Central Triage Form (61017) and Emergency Department Triage Form (61133)
    SELECT COUNT(DISTINCT f.person_id) AS triaged_total,
           COUNT(DISTINCT CASE WHEN f.concept_id = 61133 THEN f.person_id END) AS em_triaged,
           COUNT(DISTINCT CASE WHEN f.concept_id = 61017 THEN f.person_id END) AS central_triaged
    FROM obs f
    WHERE f.voided = 0
      AND f.concept_id IN (61017, 61133)
      AND DATE(f.obs_datetime) BETWEEN '#startDate#' AND '#endDate#'
) t
ORDER BY labels.sort_order;
