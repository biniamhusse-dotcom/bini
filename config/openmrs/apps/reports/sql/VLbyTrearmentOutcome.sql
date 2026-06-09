
-- Number of visceral leishmaniasis patients treated by treatment outcome

SELECT '=========Total number of VL patients treated by treatment outcome ==========' AS "Treatment Outcome",
    COALESCE(SUM(CASE WHEN ob.concept_id = 	62361 AND ob.value_coded IN (57464, 57464, 	62068, 31281, 61956) THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'
UNION ALL

SELECT 'Cured' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 57464 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Defaulted' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 57464 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Failed' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id =  62361 AND ob.value_coded = 62068 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Dead' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62361 AND ob.value_coded = 31281 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'

UNION ALL
SELECT 'Referred' AS "Treatment Outcome", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 	62361 AND ob.value_coded = 61956 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 65231
    )
    AND date(ob.date_created) BETWEEN '2023-03-28 12:40:23' AND '2024-06-03 12:55:58'