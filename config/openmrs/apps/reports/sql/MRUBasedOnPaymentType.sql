SELECT 
  cn.name                                                      AS "Payment Method",
  count(DISTINCT pa.person_id)                                          AS "Number of Patients"
  
FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  JOIN person p ON p.person_id = v.patient_id
  JOIN person_attribute pa ON p.person_id = pa.person_id
  JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name="PaymentMethod"
  LEFT OUTER JOIN concept_name cn ON pa.value = cn.concept_id
WHERE
    cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'
GROUP BY cn.name