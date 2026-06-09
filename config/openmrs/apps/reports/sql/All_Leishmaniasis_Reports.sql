-- Number of visceral leishmaniasis patients treated by age and sex

SELECT `Disaggregation`, `Number of Cases` FROM (

SELECT '========== Total Number of VL patients treated by age and sex ==========' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN ob.concept_id = 18846 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

    UNION ALL

    SELECT '< 5 years, Male' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 5 AND ob.concept_id = 18846 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '< 5 years, Female' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 5 AND ob.concept_id = 18846 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '5 - 14 years, Male' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND ob.concept_id = 18846 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '5 - 14 years, Female' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND ob.concept_id = 18846 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '>= 15 years, Male' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 15 AND ob.concept_id = 18846 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '>= 15 years, Female' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 15 AND ob.concept_id = 18846 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'
) AS all_counts

UNION ALL

-- Number of visceral leishmaniasis patients treated by treatment type

SELECT '========== Total Number of VL patients treated by treatment type ==========' AS "Disaggregation", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18846 AND (ob.value_coded = 18844 OR ob.value_coded = 1084 OR ob.value_coded = 18845) THEN 1 ELSE 0 END), 0) AS "Number of Cases"
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

    UNION ALL

SELECT 'Primary visceral leishmaniasis' AS "Disaggregation", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18846 AND ob.value_coded = 18844 THEN 1 ELSE 0 END), 0) AS "Number of Cases"
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

UNION ALL

SELECT 'Relapse visceral leishmaniasis' AS "Disaggregation", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18846 AND ob.value_coded = 1084 THEN 1 ELSE 0 END), 0) AS "Number of Cases"
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

UNION ALL

SELECT 'Post Kala-azar dermal leishmaniasis (PKDL)' AS "Disaggregation", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18846 AND ob.value_coded = 18845 THEN 1 ELSE 0 END), 0) AS "Number of Cases"
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

UNION ALL

-- Number of visceral leishmaniasis patients treated by treatment outcome

SELECT '=========Total number of VL patients treated by treatment outcome ==========' AS "Treatment Outcome",
    COALESCE(SUM(CASE WHEN ob.concept_id = 18969 AND ob.value_coded IN (1068, 10258, 10243, 3164, 2922) THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'
UNION ALL

SELECT 'Cured' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18969 AND ob.value_coded = 1068 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Defaulted' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18969 AND ob.value_coded = 10258 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Failed' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18969 AND ob.value_coded = 10243 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Dead' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18969 AND ob.value_coded = 3164 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Referred' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18969 AND ob.value_coded = 2922 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18842
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
-- Number of visceral leishmaniasis patients treated by HIV test result status
SELECT '=========== Total number of VL patients treated by HIV test result ==========' AS "HIV Status", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18746 AND ob.value_coded  IN (1738, 1016) THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18846 AND o.value_coded IS NOT NULL
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'
UNION ALL
SELECT 'Positive' AS "HIV Status", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18746 AND ob.value_coded = 1738 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18846 AND o.value_coded IS NOT NULL
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Negative' AS "HIV Status", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 18746 AND ob.value_coded = 1016 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 18846 AND o.value_coded IS NOT NULL
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58';