-- Number of visceral leishmaniasis patients treated by age and sex

SELECT `Disaggregation`, `Number of Cases` FROM (

SELECT '========== Total Number of VL patients treated by age and sex ==========' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN ob.concept_id = 	65084 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 	65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

    UNION ALL

    SELECT '< 5 years, Male' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 5 AND ob.concept_id = 64455 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '< 5 years, Female' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) < 5 AND ob.concept_id = 64455 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id =	65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '5 - 14 years, Male' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND ob.concept_id = 64455 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '5 - 14 years, Female' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) BETWEEN 5 AND 14 AND ob.concept_id = 64455  AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '>= 15 years, Male' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'M' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 15 AND ob.concept_id = 64455 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 	65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'

    UNION ALL

    SELECT '>= 15 years, Female' AS `Disaggregation`, 
        COALESCE(SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 15 AND ob.concept_id = 	64455 AND ob.value_coded IS NOT NULL THEN 1 ELSE 0 END), 0) AS `Number of Cases`
    FROM obs ob
    JOIN person p ON ob.person_id = p.person_id
    WHERE EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58 21:07:15'
) AS all_counts;