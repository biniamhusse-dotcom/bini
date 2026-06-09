-- Number of cutaneous leishmaniasis patients treated by treatment type

SELECT 'Primary cutaneous leishmaniasis' AS "Treatment Type", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62334 AND ob.value_coded = 	62003 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Relapse cutaneous leishmaniasis' AS "Treatment Type", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62334 AND ob.value_coded = 64180 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id =63029
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';