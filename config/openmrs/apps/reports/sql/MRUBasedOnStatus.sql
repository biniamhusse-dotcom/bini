SELECT t.age AS "Age",
 t.New as "New",  t.Repeat as "Repeat",  t.total as "Total"
 from(
select case    
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 5 then '0-5'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 5 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 10 then '6-10'  
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 10 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 19 then '11-19'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 19 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 29 then '20-29'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 29 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 45 then '30-45'
    when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 45 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 65 then '46-65'
    else '>65'   
    end     AS "Age",
  sum(if(cast(v.date_created as date)=cast(p.date_created as date),1,0)) as "New",
  sum(if(cast(v.date_created as date)!=cast(p.date_created as date),1,0)) as "Repeat",
  count(p.person_id) AS 'Total'
  
FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  JOIN person p ON p.person_id = v.patient_id
  WHERE
    cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
GROUP BY
Age) as t
UNION ALL
SELECT "Total", sum(s.new), sum(s.repeat), sum(s.total)
 from(
select    
   vt.name    AS "age",
  sum(if(cast(v.date_created as date)=cast(p.date_created as date),1,0)) as "New",
  sum(if(cast(v.date_created as date)!=cast(p.date_created as date),1,0)) as "Repeat",
  count(p.person_id) AS 'Total'
  
FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  JOIN person p ON p.person_id = v.patient_id
  WHERE
    cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
GROUP BY
Age) as s