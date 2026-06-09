SELECT DISTINCT
  vt.name                                         AS "Service Unit",
  count(v.patient_id)                             AS "Number of patient"

FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id

WHERE
    cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
GROUP BY
  vt.name

UNION ALL
select "Total", sum(s.patients)
 from(
  select
  count(v.patient_id) AS "patients"
  FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  WHERE
  cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
  GROUP BY
  vt.name
) as s