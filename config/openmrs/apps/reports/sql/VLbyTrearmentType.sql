-- Number of visceral leishmaniasis patients treated by treatment type

SELECT '========== Total Number of VL patients treated by treatment type ==========' AS "Disaggregation", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 64455 AND (ob.value_coded = 	64454 OR ob.value_coded = 31090 OR ob.value_coded = 67942) THEN 1 ELSE 0 END), 0) AS "Number of Cases"
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 	65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

    UNION ALL

SELECT 'Primary visceral leishmaniasis' AS "Disaggregation", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 64455 AND ob.value_coded = 64454 THEN 1 ELSE 0 END), 0) AS "Number of Cases"
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 	65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58'

UNION ALL

SELECT 'Relapse visceral leishmaniasis' AS "Disaggregation", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 64455 AND ob.value_coded = 31090 THEN 1 ELSE 0 END), 0) AS "Number of Cases"
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND DATE(ob.date_created) BETWEEN '2023-03-28' AND '2024-06-03 12:55:58';