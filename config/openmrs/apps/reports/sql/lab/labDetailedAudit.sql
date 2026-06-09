SELECT 
    COALESCE(pi.identity_data, 'ID:' || p.id) AS "MRN", 
    CONCAT(pe.first_name, ' ', pe.last_name)   AS "Patient Name", 
    p.gender                                   AS "Sex",
    EXTRACT(YEAR FROM AGE(p.birth_date))        AS "Age",
    s.accession_number                         AS "Accession No", 
    ss.name                                    AS "Sender Location", 
    t.name                                     AS "Test Name", 

    -- Resolve dictionary IDs to display names, fallback to raw value
    COALESCE(d.dict_entry, r.value)            AS "Result Value",

    -- TAT in minutes (collection → approval)
    ROUND(CAST(ABS(EXTRACT(EPOCH FROM (a.lastupdated - s.collection_date)) / 60) AS NUMERIC), 0) AS "TAT (Min)",

    -- TAT References from test table
    COALESCE(t.time_ta_average::varchar, 'N/A') AS "Ref Avg TAT (Min)",
    COALESCE(t.time_ta_max::varchar,     'N/A') AS "Ref Max TAT (Min)",

    -- TI / TO based on Max TAT reference
    CASE 
        WHEN t.time_ta_max IS NULL THEN 'No Ref'
        WHEN ROUND(CAST(ABS(EXTRACT(EPOCH FROM (a.lastupdated - s.collection_date)) / 60) AS NUMERIC), 0)
             <= t.time_ta_max THEN 'TI'
        ELSE 'TO'
    END AS "TI/TO",

    -- % over Avg TAT target (only shown when TO and avg ref exists)
    CASE
        WHEN t.time_ta_max IS NOT NULL
         AND t.time_ta_average IS NOT NULL
         AND t.time_ta_average > 0
         AND ROUND(CAST(ABS(EXTRACT(EPOCH FROM (a.lastupdated - s.collection_date)) / 60) AS NUMERIC), 0)
             > t.time_ta_max
        THEN ROUND(
               (
                 (ROUND(CAST(ABS(EXTRACT(EPOCH FROM (a.lastupdated - s.collection_date)) / 60) AS NUMERIC), 0)
                  - t.time_ta_average)
                 / t.time_ta_average::numeric
               ) * 100, 1
             )::varchar || '% over avg'
        ELSE NULL
    END AS "Over Avg Target",

    -- Staff who registered the sample 
    COALESCE(NULLIF(TRIM(CONCAT(su_c.first_name, ' ', su_c.last_name)), ''), 'N/A') AS "Collected User", 

    -- Staff who validated (signed) the result 
    COALESCE(NULLIF(TRIM(CONCAT(su_v.first_name, ' ', su_v.last_name)), ''), 'Not Validated') AS "Validate User", 

    TO_CHAR(s.collection_date, 'DD-Mon HH24:MI')     AS "Collected Time", 
    TO_CHAR(a.lastupdated,     'DD-Mon-YYYY HH24:MI') AS "Approved Time" 

FROM analysis a 
JOIN result r       ON a.id          = r.analysis_id 
JOIN test t         ON a.test_id     = t.id 
JOIN sample_item si ON a.sampitem_id = si.id 
JOIN sample s       ON si.samp_id    = s.id 
JOIN sample_human sh ON s.id         = sh.samp_id 
JOIN patient p      ON sh.patient_id = p.id 
JOIN person pe      ON p.person_id   = pe.id 

LEFT JOIN sample_source ss   ON s.sample_source_id  = ss.id 
LEFT JOIN patient_identity pi ON p.id = pi.patient_id AND pi.identity_type_id = 2 
LEFT JOIN system_user su_c   ON s.sys_user_id        = su_c.id 
LEFT JOIN result_signature rs ON r.id                = rs.result_id 
LEFT JOIN system_user su_v   ON rs.system_user_id    = su_v.id 
LEFT JOIN dictionary d       ON r.value              = d.id::varchar

WHERE r.value IS NOT NULL AND r.value <> '' 
  AND a.lastupdated >= CAST('#startDate#' AS DATE) 
  AND a.lastupdated <  CAST('#endDate#'   AS DATE) + interval '1 day'

ORDER BY a.lastupdated DESC