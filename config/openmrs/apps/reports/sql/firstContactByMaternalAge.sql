-- https://10.139.8.80/openmrs/ws/rest/v1/bahmnicore/sql?q=emrapi.firstContactByMaternalAge


SELECT 'Antenatal care First contact Age 10 - 14 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 10 AND 14 AND ob.value_coded = 	61484 AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '2024-11-17T13:05:30.000+0000' AND '2025-01-17T13:05:30.000+0000'

UNION ALL
SELECT 'Antenatal care – First contact Age 15 - 19 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created)  BETWEEN 15 AND 19 AND ob.value_coded = 	61484 AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '2024-11-17T13:05:30.000+0000' AND '2025-01-17T13:05:30.000+0000'

UNION ALL
SELECT 'Antenatal care – First contact Age >= 20 years' AS Disaggregation, 
    SUM(CASE WHEN p.gender = 'F' AND TIMESTAMPDIFF(YEAR, p.birthdate, ob.date_created) >= 20 AND ob.value_coded = 	61484 AND ob.voided = 0 THEN 1 ELSE 0 END) AS Count
FROM obs ob
JOIN 
    person p ON ob.person_id = p.person_id
WHERE 
    date(ob.date_created) BETWEEN '2024-11-17T13:05:30.000+0000' AND '2025-01-17T13:05:30.000+0000';