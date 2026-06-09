-- Number of pregnant women De-wormed

SELECT 'Number of pregnant women De-wormed' AS Disaggregation, 
    COALESCE(SUM(CASE WHEN p.gender = 'F' AND ob.concept_id = 	61593 AND ob.value_coded = 1 AND ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    EXISTS (
        SELECT 1 
        FROM obs o 
        WHERE o.person_id = ob.person_id AND (o.value_coded = 61484 OR o.value_coded = 61485 OR o.value_coded = 61486 OR o.value_coded = 61487 OR o.value_coded = 61488 OR o.value_coded = 61489 OR o.value_coded = 61490 OR o.value_coded = 61491) AND o.voided = 0
    )
    AND 
    date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';