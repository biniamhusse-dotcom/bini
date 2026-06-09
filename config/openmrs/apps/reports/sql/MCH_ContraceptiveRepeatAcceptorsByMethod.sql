-- Contraceptive repeat acceptors by Method

SELECT 'Oral contraceptives' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 62808 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63919 AND o.value_coded = 28053
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Injectables' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 61783 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63919 AND o.value_coded = 28053
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Implants' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 61788 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63919 AND o.value_coded = 28053
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'IUCD' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 62687 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63919 AND o.value_coded = 28053
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Vasectomy' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 61787 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63919 AND o.value_coded = 28053
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT 'Tubal ligation' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 61786 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63919 AND o.value_coded = 28053
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
UNION ALL
SELECT 'Others' AS "Method", 
    COALESCE(SUM(CASE WHEN ob.concept_id = 62733 AND ob.value_coded = 9750 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.encounter_id = ob.encounter_id
            AND o.concept_id = 63919 AND o.value_coded = 28053
    )
    AND date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';