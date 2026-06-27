-- Delete old entries
DELETE FROM global_property WHERE property IN ('emr.eapts.api', 'emr.eapts.api.dtp');

-- Register emr.eapts.api
INSERT INTO global_property (property, property_value, description, uuid)
VALUES ('emr.eapts.api',
'SELECT 
  pn.given_name AS prescriber_firstName,
  pn.middle_name AS prescriber_middleName,
  pn.family_name AS prescriber_lastName,
  ''Doctor'' AS prescriber_role,
  '''' AS prescriber_registrationNumber,
  prov.uuid AS prescriber_rowGuid,
  ptn.given_name AS firstName,
  ptn.middle_name AS middleName,
  ptn.family_name AS lastName,
  COALESCE(phone_attr.value, '''') AS phoneNumber,
  TIMESTAMPDIFF(YEAR, pt.birthdate, CURDATE()) AS age,
  0 AS weight,
  pt.gender AS sex,
  '''' AS houseNumber,
  COALESCE(pi.identifier, '''') AS cardNumber,
  pt.uuid AS patient_rowGuid,
  COALESCE(NULLIF(pmt_c.uuid, ''''), ''4a9afabb-f066-4267-a943-e489409368f3'') AS paymentType,
  '''' AS sponsorName,
  ''c5129e01-02b6-44e5-8386-7f5c5a7f9266'' AS patientTypeId,
  COALESCE(pa.address5, '''') AS woredaId,
  doord.dose AS dose,
  COALESCE(doord.dose, 0) AS strength,
  doord.quantity AS quantity,
  doord.duration_units AS duration_units,
  doord.duration AS numberOfDuration,
  COALESCE(doord.dosing_instructions, '''') AS additionalNote,
  o.order_id AS orderNumber,
  COALESCE(route_c.uuid, ''01d045a0-adf0-4065-9f5d-4fdc65c3ea92'') AS administrationId,
  COALESCE(freq_c.uuid, ''488b58ff-64f5-4f8a-8979-fa79940b1594'') AS frequencyTypeId,
  COALESCE(dm.dagu_item_uuid, d.uuid) AS itemUnitId,
  DATE_FORMAT(o.date_activated, ''%Y-%m-%dT%H:%i:%s.000Z'') AS prescriptionDate,
  COALESCE(diag.diag_uuids, '''') AS diagnosises,
  COALESCE(diag.diag_info, '''') AS additionalInfo,
  enc.uuid AS rowGuid
FROM orders o
JOIN drug_order doord ON o.order_id = doord.order_id
JOIN drug d ON doord.drug_inventory_id = d.drug_id
JOIN encounter enc ON o.encounter_id = enc.encounter_id
JOIN person pt ON o.patient_id = pt.person_id
JOIN patient pat ON pt.person_id = pat.patient_id
JOIN person_name ptn ON pt.person_id = ptn.person_id AND ptn.preferred = 1
JOIN encounter_provider ep ON enc.encounter_id = ep.encounter_id
JOIN provider prov ON ep.provider_id = prov.provider_id
JOIN person_name pn ON prov.person_id = pn.person_id
LEFT JOIN patient_identifier pi ON pat.patient_id = pi.patient_id AND pi.preferred = 1
LEFT JOIN person_attribute phone_attr ON pt.person_id = phone_attr.person_id AND phone_attr.person_attribute_type_id = 14
LEFT JOIN person_attribute pm ON pt.person_id = pm.person_id AND pm.person_attribute_type_id = 22
LEFT JOIN person_address pa ON pt.person_id = pa.person_id AND pa.preferred = 1
LEFT JOIN concept pmt_c ON pmt_c.concept_id = pm.value + 0
LEFT JOIN concept route_c ON route_c.concept_id = doord.route
LEFT JOIN order_frequency ord_freq ON ord_freq.order_frequency_id = doord.frequency
LEFT JOIN concept freq_c ON freq_c.concept_id = ord_freq.concept_id
LEFT JOIN eapts_drug_mapping dm ON doord.drug_inventory_id = dm.openmrs_drug_id
LEFT JOIN (
  SELECT obs.encounter_id,
    GROUP_CONCAT(DISTINCT cn_diag.uuid SEPARATOR ''#'') AS diag_uuids,
    COALESCE(MAX(CASE WHEN obs.obs_id IS NOT NULL THEN obs.value_text ELSE '''' END), '''') AS diag_info
  FROM obs
  JOIN concept_name cn_diag ON obs.value_coded = cn_diag.concept_id AND cn_diag.concept_name_type = ''FULLY_SPECIFIED'' AND cn_diag.voided = 0
  WHERE obs.concept_id = 22 AND obs.voided = 0
  GROUP BY obs.encounter_id
) diag ON enc.encounter_id = diag.encounter_id
WHERE o.order_type_id = 2 AND o.voided = 0
ORDER BY o.date_activated DESC',
'emr.eapts.api - Active prescription sync to Dagu',
UUID());

-- Register emr.eapts.api.dtp
INSERT INTO global_property (property, property_value, description, uuid)
VALUES ('emr.eapts.api.dtp',
'SELECT 
  pn.given_name AS prescriber_firstName,
  pn.middle_name AS prescriber_middleName,
  pn.family_name AS prescriber_lastName,
  ''Doctor'' AS prescriber_role,
  '''' AS prescriber_registrationNumber,
  prov.uuid AS prescriber_rowGuid,
  ptn.given_name AS firstName,
  ptn.middle_name AS middleName,
  ptn.family_name AS lastName,
  COALESCE(phone_attr.value, '''') AS phoneNumber,
  TIMESTAMPDIFF(YEAR, pt.birthdate, CURDATE()) AS age,
  0 AS weight,
  pt.gender AS sex,
  '''' AS houseNumber,
  COALESCE(pi.identifier, '''') AS cardNumber,
  pt.uuid AS patient_rowGuid,
  COALESCE(NULLIF(pmt_c.uuid, ''''), ''4a9afabb-f066-4267-a943-e489409368f3'') AS paymentType,
  '''' AS sponsorName,
  ''c5129e01-02b6-44e5-8386-7f5c5a7f9266'' AS patientTypeId,
  COALESCE(pa.address5, '''') AS woredaId,
  doord.dose AS dose,
  COALESCE(doord.dose, 0) AS strength,
  doord.quantity AS quantity,
  doord.duration_units AS duration_units,
  doord.duration AS numberOfDuration,
  COALESCE(doord.dosing_instructions, '''') AS additionalNote,
  o.order_id AS orderNumber,
  COALESCE(route_c.uuid, ''01d045a0-adf0-4065-9f5d-4fdc65c3ea92'') AS administrationId,
  COALESCE(freq_c.uuid, ''488b58ff-64f5-4f8a-8979-fa79940b1594'') AS frequencyTypeId,
  COALESCE(dm.dagu_item_uuid, d.uuid) AS itemUnitId,
  DATE_FORMAT(o.date_activated, ''%Y-%m-%dT%H:%i:%s.000Z'') AS prescriptionDate,
  COALESCE(diag.diag_uuids, '''') AS diagnosises,
  COALESCE(diag.diag_info, '''') AS additionalInfo,
  enc.uuid AS rowGuid
FROM orders o
JOIN drug_order doord ON o.order_id = doord.order_id
JOIN drug d ON doord.drug_inventory_id = d.drug_id
JOIN encounter enc ON o.encounter_id = enc.encounter_id
JOIN person pt ON o.patient_id = pt.person_id
JOIN patient pat ON pt.person_id = pat.patient_id
JOIN person_name ptn ON pt.person_id = ptn.person_id AND ptn.preferred = 1
JOIN encounter_provider ep ON enc.encounter_id = ep.encounter_id
JOIN provider prov ON ep.provider_id = prov.provider_id
JOIN person_name pn ON prov.person_id = pn.person_id
LEFT JOIN patient_identifier pi ON pat.patient_id = pi.patient_id AND pi.preferred = 1
LEFT JOIN person_attribute phone_attr ON pt.person_id = phone_attr.person_id AND phone_attr.person_attribute_type_id = 14
LEFT JOIN person_attribute pm ON pt.person_id = pm.person_id AND pm.person_attribute_type_id = 22
LEFT JOIN person_address pa ON pt.person_id = pa.person_id AND pa.preferred = 1
LEFT JOIN concept pmt_c ON pmt_c.concept_id = pm.value + 0
LEFT JOIN concept route_c ON route_c.concept_id = doord.route
LEFT JOIN order_frequency ord_freq ON ord_freq.order_frequency_id = doord.frequency
LEFT JOIN concept freq_c ON freq_c.concept_id = ord_freq.concept_id
LEFT JOIN eapts_drug_mapping dm ON doord.drug_inventory_id = dm.openmrs_drug_id
LEFT JOIN (
  SELECT obs.encounter_id,
    GROUP_CONCAT(DISTINCT cn_diag.uuid SEPARATOR ''#'') AS diag_uuids,
    COALESCE(MAX(CASE WHEN obs.obs_id IS NOT NULL THEN obs.value_text ELSE '''' END), '''') AS diag_info
  FROM obs
  JOIN concept_name cn_diag ON obs.value_coded = cn_diag.concept_id AND cn_diag.concept_name_type = ''FULLY_SPECIFIED'' AND cn_diag.voided = 0
  WHERE obs.concept_id = 22 AND obs.voided = 0
  GROUP BY obs.encounter_id
) diag ON enc.encounter_id = diag.encounter_id
WHERE o.order_type_id = 2 AND o.voided = 0
ORDER BY o.date_activated DESC',
'emr.eapts.api.dtp - DTP prescription sync from Dagu',
UUID());
