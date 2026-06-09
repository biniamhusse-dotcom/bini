select t.age AS "Age",
 t.Number_of_Patient_with_medico_legal_case as "Number of Patient with medico legal case" 
 from (
select case    
        when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 5 then '0-5'
        when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 5 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 10 then '6-10'  
        when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 10 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 19 then '11-19'
        when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 19 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 29 then '20-29'
        when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 29 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 45 then '30-45'
        when floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) > 45 AND floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) <= 65 then '46-65'
        else '>65'   
        end     AS "Age",    
        sum(if(pa.value='true',1,0)) as "Number_of_Patient_with_medico_legal_case"
      
    FROM visit v
      JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
      JOIN person p ON p.person_id = v.patient_id
      JOIN person_attribute pa ON p.person_id = pa.person_id
      LEFT JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name="medicolegalcases"
      WHERE
        cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'

GROUP BY
Age
 ) as t
UNION ALL
select "Total",
 sum(Number_of_Patient_with_medico_legal_case)
 from (select    
        vt.name       AS "age",  
        sum(if(pa.value='true',1,0)) as "Number_of_Patient_with_medico_legal_case"
      
    FROM visit v
      JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
      JOIN person p ON p.person_id = v.patient_id
      JOIN person_attribute pa ON p.person_id = pa.person_id
      LEFT JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name="medicolegalcases"
      WHERE
        cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'

GROUP BY
Age
 ) as s