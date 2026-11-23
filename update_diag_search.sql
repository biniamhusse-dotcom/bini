UPDATE global_property
SET property_value = 'SELECT DISTINCT 
    c.uuid as conceptUuid,
    COALESCE(cn_pref.name, cn.name) as conceptName,
    COALESCE(cn_pref.name, cn.name) as matchedName,
    cr.code as code,
    cs.name as conceptSystem
FROM concept_reference_term cr
JOIN concept_reference_source cs ON cr.concept_source_id = cs.concept_source_id
JOIN concept_reference_map crm ON cr.concept_reference_term_id = crm.concept_reference_term_id
JOIN concept c ON crm.concept_id = c.concept_id AND c.retired = 0
LEFT JOIN concept_name cn_pref ON c.concept_id = cn_pref.concept_id AND cn_pref.voided = 0 AND cn_pref.locale = ''en'' AND cn_pref.locale_preferred = 1
LEFT JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.voided = 0 AND cn.concept_name_type = ''FULLY_SPECIFIED''
WHERE cr.retired = 0
  AND (cr.code LIKE CONCAT(${term}, ''%'') OR cr.code = ${term})
LIMIT 25;'
WHERE property = 'emrapi.sqlsearch.diagnosisSearchByCode';
