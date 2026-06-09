-- Total Number of pregnant women that received antenatal care – First contact by gestational Age

SELECT 'Antenatal care – First contact GA <= 12 weeks' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.value_coded = 61484 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.value_numeric <= 12 AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Antenatal care – First contact GA > 12 and <= 16 weeks' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.value_coded = 61484 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.value_numeric BETWEEN 13 AND 16 AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Antenatal care – First contact GA > 16 weeks' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.value_coded = 61484 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.value_numeric > 16 AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';