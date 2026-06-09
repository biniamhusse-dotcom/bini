WITH RawData AS (
    -- This section filters all data based on the selected date range
    SELECT 
        ss.name AS location_name,
        s.id AS sample_id,
        sh.patient_id,
        s.collection_date,
        s.entered_date,
        sos.description AS status_desc
    FROM sample s
    LEFT JOIN sample_source ss ON s.sample_source_id = ss.id
    LEFT JOIN sample_human sh ON s.id = sh.samp_id
    LEFT JOIN status_of_sample sos ON s.status_id = sos.id
    WHERE 
        -- Filter for samples physically collected within the range
        (s.collection_date >= CAST('#startDate#' AS DATE) 
         AND s.collection_date < CAST('#endDate#' AS DATE) + interval '1 day')
        OR 
        -- Filter for samples registered but NOT YET collected within the range
        (s.collection_date IS NULL 
         AND s.entered_date >= CAST('#startDate#' AS DATE) 
         AND s.entered_date < CAST('#endDate#' AS DATE) + interval '1 day')
)

-- 1. THE SUMMARY ROW (Grand Total at the Top)
SELECT 
    '*** GRAND TOTAL ***' AS "Sender Location",
    SUM(CASE WHEN collection_date IS NULL THEN 1 ELSE 0 END) AS "To collect",
    SUM(CASE WHEN collection_date IS NOT NULL THEN 1 ELSE 0 END) AS "Collected",
    COUNT(sample_id) AS "Total Samples",
    SUM(CASE WHEN status_desc = 'Entered' AND collection_date IS NOT NULL THEN 1 ELSE 0 END) AS "Awaiting Testing",
    SUM(CASE WHEN status_desc = 'Complete' THEN 1 ELSE 0 END) AS "Awaiting Validation",
    SUM(CASE WHEN status_desc = 'Final' THEN 1 ELSE 0 END) AS "Completed",
    COUNT(DISTINCT patient_id) AS "Total Patients",
    0 AS sort_order -- Forces this row to the top

FROM RawData

UNION ALL

-- 2. THE LOCATION BREAKDOWN (Individual Rows)
SELECT 
    COALESCE(location_name, 'Unknown Location') AS "Sender Location",
    SUM(CASE WHEN collection_date IS NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN collection_date IS NOT NULL THEN 1 ELSE 0 END),
    COUNT(sample_id),
    SUM(CASE WHEN status_desc = 'Entered' AND collection_date IS NOT NULL THEN 1 ELSE 0 END),
    SUM(CASE WHEN status_desc = 'Complete' THEN 1 ELSE 0 END),
    SUM(CASE WHEN status_desc = 'Final' THEN 1 ELSE 0 END),
    COUNT(DISTINCT patient_id),
    1 AS sort_order -- Keeps these rows below the summary

FROM RawData
GROUP BY location_name

ORDER BY sort_order ASC, "Total Samples" DESC;
