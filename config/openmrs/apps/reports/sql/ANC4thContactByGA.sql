-- Total number of pregnant women that received four or more antenatal care contacts by gestational age

SELECT 'Four or more antenatal care contacts <= 30 weeks' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN (ob.value_coded = 61487 OR ob.value_coded = 61488 OR ob.value_coded = 61489 OR ob.value_coded = 61490 OR ob.value_coded = 61491) AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.value_numeric <= 30 AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Four or more antenatal care contacts > 30 weeks' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN (ob.value_coded = 61487 OR ob.value_coded = 61488 OR ob.value_coded = 61489 OR ob.value_coded = 61490 OR ob.value_coded = 61491) AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.value_numeric > 30 AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Number of pregnant women that received antenatal care – 8 Contacts and more' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN ob.value_coded = 61491 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 61143 AND o.voided = 0
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';