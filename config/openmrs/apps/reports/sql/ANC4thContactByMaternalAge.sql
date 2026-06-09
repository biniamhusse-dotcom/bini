-- Total number of pregnant women that received four or more antenatal care contacts by Maternal Age

SELECT 'Four or more antenatal care contacts 10 - 14 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 10 AND 14 AND 
    (ob.value_coded = 61487 OR ob.value_coded = 61488 OR ob.value_coded = 61489 OR ob.value_coded = 61490 OR ob.value_coded = 61491) AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Four or more antenatal care contacts 15 - 19 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 15 AND 19  AND 
    (ob.value_coded = 61487 OR ob.value_coded = 61488 OR ob.value_coded = 61489 OR ob.value_coded = 61490 OR ob.value_coded = 61491) AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#'

UNION ALL
SELECT 'Four or more antenatal care contacts >= 20 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 20  AND 
    (ob.value_coded = 61487 OR ob.value_coded = 61488 OR ob.value_coded = 61489 OR ob.value_coded = 61490 OR ob.value_coded = 61491) AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '#startDate#' AND '#endDate#';