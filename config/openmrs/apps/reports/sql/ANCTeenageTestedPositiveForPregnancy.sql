-- Total number of teenage girls tested positive for pregnancy

SELECT 'Number of teenage girls tested positive for pregnancy age 10 - 14 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 10 AND 14 AND ob.concept_id = 9876 AND ob.value_coded = 6574 AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Number of teenage girls tested positive for pregnancy age 15 - 19 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 15 AND 19 AND ob.concept_id = 9876 AND ob.value_coded = 6574 AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Total number of women tested for pregnancy' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND ob.concept_id = 9876 AND (ob.value_coded = 6574 OR ob.value_coded = 57327) AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';