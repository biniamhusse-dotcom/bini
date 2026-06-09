SELECT
    'Total Number of pregnant women that received antenatal care – First contact by gestational Age' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.value_numeric IS NOT NULL
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded = 61484
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'GA <= 12 weeks' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.value_numeric <= 12
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded = 61484
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'GA > 12 and <= 16 weeks' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.value_numeric BETWEEN 13
    AND 16
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded = 61484
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'GA > 16 weeks' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.value_numeric > 16
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded = 61484
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total Number of pregnant women that received antenatal care – First contact by maternal age' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 10
            AND ob.concept_id = 61492
            AND ob.value_coded = 61484
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Age 10 - 14 years' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 10
            AND 14
            AND ob.concept_id = 61492
            AND ob.value_coded = 61484
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Age 15 - 19 years' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15
            AND 19
            AND ob.concept_id = 61492
            AND ob.value_coded = 61484
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Age >= 20 years' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 20
            AND ob.concept_id = 61492
            AND ob.value_coded = 61484
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total number of pregnant women that received four or more antenatal care contacts by gestational age' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.value_numeric IS NOT NULL
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded IN(61487, 61488, 61489, 61490, 61491)
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'GA <= 30 weeks' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.value_numeric <= 30
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded IN(61487, 61488, 61489, 61490, 61491)
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'GA > 30 weeks' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.value_numeric > 30
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded IN(61487, 61488, 61489, 61490, 61491)
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total Number of pregnant women that received antenatal care – 8 Contacts and more' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON ob.encounter_id = o.encounter_id
    AND o.concept_id = 61143
    AND o.voided = 0
WHERE
    ob.concept_id = 61492
    AND ob.value_coded = 61491
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total number of pregnant women that received four or more antenatal care contacts by maternal age' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 10
            AND ob.concept_id = 61492
            AND ob.value_coded IN(61487, 61488, 61489, 61490, 61491)
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Age 10 - 14 years' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 10
            AND 14
            AND ob.concept_id = 61492
            AND ob.value_coded IN(61487, 61488, 61489, 61490, 61491)
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Age 15 - 19 years' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15
            AND 19
            AND ob.concept_id = 61492
            AND ob.value_coded IN(61487, 61488, 61489, 61490, 61491)
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Age >= 20 years' AS Disaggregation,
    SUM(
        CASE
            WHEN p.gender = 'F'
            AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 20
            AND ob.concept_id = 61492
            AND ob.value_coded IN(61487, 61488, 61489, 61490, 61491)
            AND ob.voided = 0 THEN 1
            ELSE 0
        END
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total Number of pregnant women De-wormed' AS Disaggregation,
    COUNT(ob.obs_id) AS Count
FROM
    obs ob
WHERE
    ob.concept_id = 61593
    AND ob.value_coded = 1
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total number of Pregnant women received IFA at least 90 plus' AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN p.gender = 'F'
                AND ob.concept_id = 63685
                AND ob.value_coded = 1 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    JOIN person p ON p.person_id = ob.person_id
WHERE
    ob.concept_id = 63685
    AND ob.value_coded = 1
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    CASE
        WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 10 AND 14 THEN '10 - 14 Years'
        WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15 AND 19 THEN '15 - 19 Years'
        WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 20 THEN '>= 20 Years'
    END AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN p.gender = 'F'
                AND ob.concept_id = 63685
                AND ob.value_coded = 1 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    ob.concept_id = 63685
    AND ob.value_coded = 1 AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
GROUP BY Disaggregation
UNION ALL
SELECT
    'Total number of pregnant women who received an obstetric ultrasound' AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN ob.concept_id = 13845
                AND ob.voided = 0 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    INNER JOIN orders ord ON ob.person_id = ord.patient_id
    AND ob.order_id = ord.order_id
WHERE
    ord.concept_id = 67439
    AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Before 20 weeks of gestation' AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN ob.concept_id = 13845
                AND ob.value_numeric < 20
                AND ob.voided = 0 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    INNER JOIN orders ord ON ob.person_id = ord.patient_id
    AND ob.order_id = ord.order_id
WHERE
    ord.concept_id = 67439
    AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'After 20 weeks of gestation' AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN ob.concept_id = 13845
                AND ob.value_numeric >= 20
                AND ob.voided = 0 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    INNER JOIN orders ord ON ob.person_id = ord.patient_id
    AND ob.order_id = ord.order_id
WHERE
    ord.concept_id = 67439
    AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total number of teenage girls tested positive for pregnancy (10 - 19 Years)' AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN p.gender = 'F'
                AND ob.concept_id = 9876
                AND ob.value_coded = 6574 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    ob.voided = 0
    AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 10
    AND 19
    AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    CASE
        WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 10
        AND 14 THEN 'Age 10 - 14 Years'
        WHEN TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 15
        AND 19 THEN 'Age 15 - 19 Years'
    END AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN p.gender = 'F'
                AND ob.concept_id = 9876
                AND ob.value_coded = 6574 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    ob.voided = 0
    AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 10
    AND 19
    AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
GROUP BY Disaggregation
UNION ALL
SELECT
    'Total number of women tested for pregnancy' AS Disaggregation,
    COALESCE(
        SUM(
            CASE
                WHEN p.gender = 'F'
                AND ob.concept_id = 9876
                AND (
                    ob.value_coded = 6574
                    OR ob.value_coded = 57327
                )
                AND ob.voided = 0 THEN 1
                ELSE 0
            END
        ),
        0
    ) AS Count
FROM
    obs ob
    JOIN person p ON ob.person_id = p.person_id
WHERE
    ob.concept_id = 9876
    AND ob.value_coded IN (6574, 57327)
    AND ob.voided = 0
    AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total number of pregnant women tested for hepatitis B' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON o.encounter_id = ob.encounter_id
    AND o.concept_id = 61596
WHERE
    ob.concept_id = 33777
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Tested for hepatitis B (Reactive)' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON o.encounter_id = ob.encounter_id
    AND o.concept_id = 61596
WHERE
    ob.concept_id = 33777
    AND ob.value_coded = 42793
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Tested for hepatitis B (Non-Reactive)' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON o.encounter_id = ob.encounter_id
    AND o.concept_id = 61596
WHERE
    ob.concept_id = 33777
    AND ob.value_coded = 61542
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total number of pregnant women who received prophylaxis for HBV' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
WHERE
    ob.concept_id = 61568
    AND ob.value_coded = 1
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total Number of pregnant women tested for syphilis' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON o.encounter_id = ob.encounter_id
    AND o.concept_id = 61596
WHERE
    ob.concept_id = 11004
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Tested for syphilis Reactive' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON o.encounter_id = ob.encounter_id
    AND o.concept_id = 61596
WHERE
    ob.concept_id = 11004
    AND ob.value_coded = 42793
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Tested for syphilis Non-Reactive)' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
    JOIN obs o ON o.encounter_id = ob.encounter_id
    AND o.concept_id = 61596
WHERE
    ob.concept_id = 11004
    AND ob.value_coded = 61542
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT
    'Total Number of pregnant women treated for syphilis' AS Disaggregation,
    COUNT(DISTINCT ob.obs_id) AS Count
FROM
    obs ob
WHERE
    ob.concept_id = 61567
    AND ob.value_coded = 1
    AND ob.voided = 0
    AND ob.date_created BETWEEN '#startDate#' AND '#endDate#';