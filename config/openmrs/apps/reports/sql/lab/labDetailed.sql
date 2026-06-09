WITH Raw_Data AS (
  SELECT 
    p.id AS patient_internal_id,
    s.id AS samp_internal_id,
    s.accession_number,
    s.collection_date,
    a.lastupdated AS test_approved_time,
    t.name AS test_name,

    COALESCE(d.dict_entry, r.value) AS test_result,

    pe.first_name || ' ' || pe.last_name AS patient_full_name,
    pi.identity_data AS mrn_data,
    ss.name AS location_name,
    su_c.first_name || ' ' || su_c.last_name AS collector_name,
    su_v.first_name || ' ' || su_v.last_name AS validator_name,

    t.time_ta_average AS ref_avg_min,
    t.time_ta_max     AS ref_max_min,

    ROUND(CAST(ABS(EXTRACT(EPOCH FROM (a.lastupdated - s.collection_date)) / 60) AS NUMERIC), 0) AS tat_min

  FROM analysis a
  JOIN result r ON a.id = r.analysis_id
  JOIN test t ON a.test_id = t.id
  JOIN sample_item si ON a.sampitem_id = si.id
  JOIN sample s ON si.samp_id = s.id
  JOIN sample_human sh ON s.id = sh.samp_id
  JOIN patient p ON sh.patient_id = p.id
  JOIN person pe ON p.person_id = pe.id
  LEFT JOIN sample_source ss ON s.sample_source_id = ss.id
  LEFT JOIN patient_identity pi ON p.id = pi.patient_id AND pi.identity_type_id = 2
  LEFT JOIN system_user su_c ON s.sys_user_id = su_c.id
  LEFT JOIN result_signature rs ON r.id = rs.result_id
  LEFT JOIN system_user su_v ON rs.system_user_id = su_v.id
  LEFT JOIN dictionary d ON r.value = d.id::varchar

  WHERE r.value IS NOT NULL AND r.value <> ''
    AND a.lastupdated >= CAST('#startDate#' AS DATE)
    AND a.lastupdated < (CAST('#endDate#' AS DATE) + interval '1 day')
),

Summary_Stats AS (
  SELECT 
    COUNT(DISTINCT patient_full_name)  AS total_patients,
    COUNT(*)                           AS total_tests,
    COUNT(*) FILTER (WHERE ref_max_min IS NOT NULL AND tat_min <= ref_max_min) AS total_ti,
    COUNT(*) FILTER (WHERE ref_max_min IS NOT NULL AND tat_min >  ref_max_min) AS total_to,
    -- Tests that exceeded average TAT (even if within max)
    COUNT(*) FILTER (WHERE ref_avg_min IS NOT NULL AND tat_min >  ref_avg_min) AS total_over_avg,
    ROUND(AVG(tat_min), 1)             AS global_avg_tat,
    (SELECT test_name || ' (' || tat_min || 'm)' FROM Raw_Data ORDER BY tat_min ASC  LIMIT 1) AS min_tat_info,
    (SELECT test_name || ' (' || tat_min || 'm)' FROM Raw_Data ORDER BY tat_min DESC LIMIT 1) AS max_tat_info
  FROM Raw_Data
),

Aggregated_Samples AS (
  SELECT 
    mrn_data,
    patient_full_name,
    accession_number,
    location_name,

    STRING_AGG(
      test_name || ': ' || test_result
      -- TAT actual + both references
      || ' [TAT: ' || tat_min || 'm'
      || ' | Ref Avg: ' || COALESCE(ref_avg_min::varchar, 'N/A') || 'm'
      || ' / Max: '    || COALESCE(ref_max_min::varchar, 'N/A') || 'm]'
      -- TI / TO status
      || CASE 
           WHEN ref_max_min IS NULL THEN ' (No Ref)'
           WHEN tat_min <= ref_max_min THEN ' ✅ TI'
           ELSE ' ❌ TO'
         END
      -- If TO: show % over avg target (when avg ref exists)
      || CASE
           WHEN ref_max_min IS NOT NULL AND tat_min > ref_max_min AND ref_avg_min IS NOT NULL AND ref_avg_min > 0
             THEN ' [+' || ROUND(((tat_min - ref_avg_min)::numeric / ref_avg_min::numeric) * 100, 1) || '% over avg target]'
           ELSE ''
         END,
      CHR(10) ORDER BY test_name
    ) AS test_list,

    collector_name,
    MAX(validator_name)       AS validator,
    collection_date,
    MAX(test_approved_time)   AS final_approval,

    ROUND(CAST(ABS(EXTRACT(EPOCH FROM (MAX(test_approved_time) - collection_date)) / 60) AS NUMERIC), 0) AS sample_tat_min,

    -- Store ref values for sample-level TI/TO assessment
    MAX(ref_avg_min) AS sample_ref_avg_min,
    MAX(ref_max_min) AS sample_ref_max_min,

    CASE 
      WHEN MAX(ref_max_min) IS NULL THEN 'No Ref'
      WHEN ROUND(CAST(ABS(EXTRACT(EPOCH FROM (MAX(test_approved_time) - collection_date)) / 60) AS NUMERIC), 0)
           <= MAX(ref_max_min) THEN 'TI'
      ELSE 'TO'
    END AS sample_tito

  FROM Raw_Data
  GROUP BY mrn_data, patient_internal_id, patient_full_name, accession_number, location_name, collection_date, collector_name
)

-- Final output
(
  -- SUMMARY ROW
  SELECT 
    'SUMMARY'                                                                              AS "MRN",
    'Clients: ' || total_patients || ' | Tests: ' || total_tests                          AS "Patient Name",
    'Avg Tests/Pt: ' || ROUND((total_tests::numeric / total_patients::numeric), 1)        AS "Accession No",
    'Avg TAT: ' || global_avg_tat || 'm'                                                  AS "Sender Location",
    'MIN TAT: ' || min_tat_info || ' | MAX TAT: ' || max_tat_info                         AS "Tests, Results & TAT",
    '---'                                                                                  AS "Collected User",
    '---'                                                                                  AS "Validate User",
    '---'                                                                                  AS "Collected Time",
    '---'                                                                                  AS "Approved Time",
    '---'                                                                                  AS "Total TAT (Min)",
    'TI: ' || total_ti || ' | TO: ' || total_to
      || ' | Over Avg Target: ' || total_over_avg                                         AS "TI/TO",
    1                                                                                      AS Sort_Order
  FROM Summary_Stats

  UNION ALL

  -- DATA ROWS
  SELECT 
    COALESCE(mrn_data, 'N/A')        AS "MRN",
    patient_full_name                AS "Patient Name",
    accession_number                 AS "Accession No",
    COALESCE(location_name, 'N/A')   AS "Sender Location",
    test_list                        AS "Tests, Results & TAT",
    COALESCE(collector_name, 'N/A')  AS "Collected User",
    COALESCE(validator, 'Validated') AS "Validate User",
    TO_CHAR(collection_date, 'DD-Mon HH:MI')          AS "Collected Time",
    TO_CHAR(final_approval, 'DD-Mon-YYYY HH:MI')      AS "Approved Time",

    -- Sample TAT with both references and % over avg if TO
    CAST(sample_tat_min AS VARCHAR)
      || 'm [Ref Avg: ' || COALESCE(sample_ref_avg_min::varchar, 'N/A') || 'm'
      || ' / Max: '    || COALESCE(sample_ref_max_min::varchar, 'N/A') || 'm]'
      || CASE
           WHEN sample_tito = 'TO' AND sample_ref_avg_min IS NOT NULL AND sample_ref_avg_min > 0
             THEN ' (+' || ROUND(((sample_tat_min - sample_ref_avg_min)::numeric / sample_ref_avg_min::numeric) * 100, 1) || '% over avg)'
           ELSE ''
         END                                          AS "Total TAT (Min)",

    sample_tito                                       AS "TI/TO",
    2                                                 AS Sort_Order
  FROM Aggregated_Samples
)
ORDER BY Sort_Order, "Approved Time" DESC