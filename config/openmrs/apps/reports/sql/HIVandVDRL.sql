SELECT 
    CASE 
        WHEN ob.concept_id = 61556 AND ob.value_coded = 67948 THEN 'Number of pregnant women Positive at ANC one visit'
        WHEN ob.concept_id = 61556 AND ob.value_coded =	62588 THEN 'Number of pregnant women Negative'
        WHEN ob.concept_id = 61556 AND ob.value_coded = 61554 THEN 'Number of pregnant women Known HIV Positive and on ART'
        WHEN ob.concept_id = 61556 AND ob.value_coded = 61555 THEN 'Number of pregnant women Known HIV Positive but not ART'
        WHEN ob.concept_id = 61556 AND ob.value_coded = 61545 THEN 'Number of pregnant women Referral in with NR'
        WHEN ob.concept_id = 61556 AND ob.value_coded = 19953 THEN 'Total Number of pregnant women Inconclusive'
        WHEN ob.concept_id = 61556 AND ob.value_coded = 61546 THEN 'No Kit'
    END AS Disaggregation,
    COALESCE(SUM(CASE WHEN ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN obs o ON ob.person_id = o.person_id
           AND o.value_coded IN (	61484) 
           AND o.voided = 0
WHERE ob.voided = 0
  AND ob.concept_id = 61556
  AND ob.value_coded IN (	67948 ,67947, 	61554, 	61555, 61545, 	19953, 	61546)
  AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
GROUP BY Disaggregation

UNION ALL

SELECT 
    CASE 
        WHEN ob.concept_id = 61547 AND ob.value_coded = 10092 THEN 'Number of pregnant women Reactive for syphlis at ANC one visit'
        WHEN ob.concept_id = 61547 AND ob.value_coded = 67949 THEN 'Number of pregnant women Non Reactive for syphlis at ANC one visit'
        WHEN ob.concept_id = 61547 AND ob.value_coded = 61544 THEN 'Number of pregnant women known Reactive for syphlis at ANC one visit'
        WHEN ob.concept_id = 61547 AND ob.value_coded = 61545 THEN 'Number of pregnant women Referral in with NR'
        WHEN ob.concept_id = 61547 AND ob.value_coded = 61546 THEN 'No Kit'
    END AS Disaggregation,
    COALESCE(SUM(CASE WHEN ob.voided = 0 THEN 1 ELSE 0 END), 0) AS Count
FROM obs ob
JOIN obs o ON ob.person_id = o.person_id
           AND o.value_coded IN (61484) 
           AND o.voided = 0
WHERE ob.voided = 0
  AND ob.concept_id = 61547
  AND ob.value_coded IN (10092, 3637, 61544, 61545, 61546)
  AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
GROUP BY Disaggregation;