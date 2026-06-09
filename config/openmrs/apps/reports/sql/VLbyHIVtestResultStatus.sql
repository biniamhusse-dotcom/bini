-- Number of visceral leishmaniasis patients treated by HIV test result status
SELECT '=========== Total number of VL patients treated by HIV test result ==========' AS "HIV Status", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 32992 AND ob.value_coded  IN (6574, 57327) THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 64455 AND o.value_coded IS NOT NULL
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'
UNION ALL
SELECT 'Positive' AS "HIV Status", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 32992 AND ob.value_coded = 6574 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 64455 AND o.value_coded IS NOT NULL
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Negative' AS "HIV Status", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 32992 AND ob.value_coded = 57327 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 64455 AND o.value_coded IS NOT NULL
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58';