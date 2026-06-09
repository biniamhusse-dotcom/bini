SELECT 
    CASE 
        WHEN ob.concept_id = 61946 THEN 'Number of Children who received BCG'
        WHEN ob.concept_id = 62521 THEN 'Number of Children who received OPV 0'
        WHEN ob.concept_id = 62533 THEN 'Number of Children who received OPV 1'
        WHEN ob.concept_id = 62534 THEN 'Number of Children who received DPT-HepB-Hib 1'
        WHEN ob.concept_id = 62536 THEN 'Number of Children who received Rota 1'
        WHEN ob.concept_id = 62535 THEN 'Number of Children who received PCV 1'
        WHEN ob.concept_id = 62537 THEN 'Number of Children who received OPV 2'
        WHEN ob.concept_id = 62538 THEN 'Number of Children who received DPT-HepB-Hib 2'
        WHEN ob.concept_id = 62540 THEN 'Number of Children who received Rota 2'
        WHEN ob.concept_id = 62539 THEN 'Number of Children who received PCV 2'
        WHEN ob.concept_id = 62541 THEN 'Number of Children who received OPV 3'
        WHEN ob.concept_id = 62542 THEN 'Number of Children who received DPT-HepB-Hib 3'
        WHEN ob.concept_id = 62543 THEN 'Number of Children who received PIV 1'
        WHEN ob.concept_id = 62546 THEN 'Number of Children who received Measeles 1'
        WHEN ob.concept_id = 21720 THEN 'Number of Children who received Fully Immunized'
        WHEN ob.concept_id = 62547 THEN 'Number of Children who received IPV 2'
        WHEN ob.concept_id = 62548 THEN 'Number of Children who received Vitamin A'
        WHEN ob.concept_id = 62550 THEN 'Number of Children who received Measeles 2'
    END AS Disaggregation,
    COUNT(*) AS Count
FROM obs ob
WHERE ob.voided = 0
  AND ob.concept_id IN (
        61946, 62521, 62533, 62534, 62536, 62535, 
        62537, 62538, 62540, 62539, 62541, 62542, 
        62543, 62546, 21720, 62547, 62548, 62550
    )
  AND DATE(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'
GROUP BY Disaggregation
ORDER BY Disaggregation;