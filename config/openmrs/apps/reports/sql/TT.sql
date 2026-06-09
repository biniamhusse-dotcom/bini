SELECT 
    CASE 
        WHEN ob.concept_id = 11628 THEN 'Number of children received TT1'
        WHEN ob.concept_id = 11629 THEN 'Number of children received TT2'
        WHEN ob.concept_id = 11630 THEN 'Number of children received TT3'
        WHEN ob.concept_id = 11631 THEN 'Number of children received TT4'
        WHEN ob.concept_id = 11632 THEN 'Number of children received TT5'
    END AS Disaggregation,
    COALESCE(SUM(CASE WHEN ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN obs o ON ob.person_id = o.person_id
           AND o.concept_id IN (11633) 
           AND o.voided = 0
WHERE ob.voided = 0
    AND ob.concept_id IN (11628, 11629, 11630, 11631, 11632)
    AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
GROUP BY Disaggregation;