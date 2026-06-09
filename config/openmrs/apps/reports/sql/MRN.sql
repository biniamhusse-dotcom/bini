SELECT DISTINCT
  concat(pn.given_name, " ", ifnull(pn.family_name, " "))       AS "Patient Name",
  floor(DATEDIFF(DATE(v.date_started), p.birthdate) / 365)      AS "Age",
  p.gender                                                      AS "Gender",
  paddress.state_province                                       AS "Region",
  paddress.city_village                                         AS "Woreda",
  u.username                                                    AS "MRU Officer",
  cn.name                                                      AS "Payment Method"
  
FROM visit v
  JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
  JOIN person p ON p.person_id = v.patient_id
  JOIN users u ON u.user_id = v.creator
  JOIN patient_identifier pi ON p.person_id = pi.patient_id
  JOIN patient_identifier_type pit ON pi.identifier_type = pit.patient_identifier_type_id
  JOIN person_name pn ON pn.person_id = p.person_id
  LEFT OUTER JOIN person_address paddress ON p.person_id = paddress.person_id
  LEFT OUTER JOIN person_attribute pa ON p.person_id = pa.person_id
  JOIN person_attribute_type pat ON pat.person_attribute_type_id = pa.person_attribute_type_id AND pat.name="PaymentMethod"
  LEFT OUTER JOIN concept_name cn ON pa.value = cn.concept_id
WHERE
    cast(v.date_created as date) BETWEEN '#startDate#' and '#endDate#'