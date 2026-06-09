select t.age AS "Age",
 t.Male as "Male",  t.Female as "Female",  t.Other as "Other", t.total as "Total"
 from(
   select case    
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) < 5 then '< 5'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) >= 5 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 10 then '5-10'  
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 10 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 19 then '11-19'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 19 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 29 then '20-29'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 29 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 45 then '30-45'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 45 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 65 then '46-65'
    else '>=66'   
    end     AS "Age",
  sum(if(p.gender='F',1,0)) as "Female",
  sum(if(p.gender='M',1,0)) as "Male",
  sum(if(p.gender='O',1,0)) as "Other",
  count(p.person_id) AS 'Total'
  
FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  JOIN person p ON p.person_id = v.patient_id
  WHERE
    v.visit_type_id NOT IN(16, 15, 19)
    AND cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
GROUP BY
Age) as t
UNION ALL
select "Total", sum(s.Male), sum(s.Female), sum(s.Other), sum(Total)
 from(
   select  vt.name  AS "Age",
  sum(if(p.gender='F',1,0)) as "Female",
  sum(if(p.gender='M',1,0)) as "Male",
  sum(if(p.gender='O',1,0)) as "Other",
  count(p.person_id) AS 'Total'
  
FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  JOIN person p ON p.person_id = v.patient_id
  WHERE
    v.visit_type_id NOT IN(123, 129, 30, 159)
    AND cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
GROUP BY
Age) as s