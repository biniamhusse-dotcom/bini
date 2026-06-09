SELECT t.service_unit AS "Service Unit",
 t.Number_of_Patients as "Number of Patients"
 from
   ( SELECT 
      vt.name       AS "service_unit",
      count(p.person_id)     AS "Number_of_Patients"
      
    FROM visit v
      JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
      JOIN person p ON p.person_id = v.patient_id
    WHERE
        cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
    GROUP BY
    vt.visit_type_id) as t

  UNION ALL 
  select 'Total',sum(Number_of_Patients) from 
  ( SELECT 
      vt.name       AS "service_unit",
      count(p.person_id)     AS "Number_of_Patients"
      
    FROM visit v
      JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
      JOIN person p ON p.person_id = v.patient_id
    WHERE
        cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
    GROUP BY
    vt.visit_type_id) as s;