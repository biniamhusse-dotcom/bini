SELECT
    vt.name AS "Service Location",
    TIMESTAMPDIFF(YEAR, p.birthdate, v.date_started) AS "Age",
    p.gender AS "Gender",
    cn.name AS "Primary Diagnosis"
FROM
    visit v
    INNER JOIN visit_type vt on v.visit_type_id = vt.visit_type_id
    AND date(v.date_started) between '#startDate#'
    and '#endDate#'
    INNER JOIN person p on p.person_id = v.patient_id
    INNER JOIN obs ob on ob.person_id = p.person_id
    INNER JOIN concept_name cn on cn.concept_id = ob.value_coded
    INNER JOIN concept c on c.concept_id = cn.concept_id
    AND c.class_id = 4
WHERE
    vt.visit_type_id != 123;