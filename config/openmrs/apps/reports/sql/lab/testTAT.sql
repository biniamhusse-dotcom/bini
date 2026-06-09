WITH Raw_Data AS (
  SELECT
    ts.name AS DDepartment,
    s.accession_number AS Accession_No,
    COALESCE(p.name, 'Individual Test') AS Panel_Name,
    t.name AS test_name,

    -- TAT references from test table
    t.time_ta_average AS ref_avg_min,
    t.time_ta_max     AS ref_max_min,

    COUNT(*) OVER (PARTITION BY s.accession_number) AS tests_in_accession,

    s.collection_date AS Collect_Time,
    a.lastupdated     AS Approve_Time,

    ABS(EXTRACT(EPOCH FROM (
      CAST(a.lastupdated AS timestamp) - CAST(s.collection_date AS timestamp)
    )) / 60) AS diff_minutes

  FROM analysis a
    JOIN test t          ON a.test_id         = t.id
    JOIN test_section ts ON t.test_section_id = ts.id
    JOIN sample_item si  ON a.sampitem_id     = si.id
    JOIN sample s        ON si.samp_id        = s.id
    LEFT JOIN panel p    ON a.panel_id        = p.id

  WHERE a.completed_date IS NOT NULL
    AND CAST(a.completed_date AS DATE) BETWEEN '#startDate#' AND '#endDate#'
),

-- Pre-compute rounded TAT once to avoid repetition
Raw_Data_Calc AS (
  SELECT *,
    ROUND(diff_minutes::numeric, 2) AS tat_min_rounded,

    -- TI/TO per test row
    CASE
      WHEN ref_max_min IS NULL THEN 'No Ref'
      WHEN ROUND(diff_minutes::numeric, 2) <= ref_max_min THEN 'TI'
      ELSE 'TO'
    END AS tito,

    -- % over avg target (only when TO and avg ref exists)
    CASE
      WHEN ref_max_min IS NOT NULL
       AND ref_avg_min IS NOT NULL
       AND ref_avg_min > 0
       AND ROUND(diff_minutes::numeric, 2) > ref_max_min
      THEN ROUND(
             ((ROUND(diff_minutes::numeric, 2) - ref_avg_min) / ref_avg_min::numeric) * 100,
             1
           )
      ELSE NULL
    END AS pct_over_avg

  FROM Raw_Data
)

-- 1. DETAILED TEST ROWS
SELECT
  DDepartment,
  Accession_No,
  Panel_Name,
  test_name                                           AS "Test / Summary Row",
  tests_in_accession                                  AS "Tests in Sample",
  TO_CHAR(Collect_Time, 'DD-Mon HH24:MI')             AS "Collected Time",
  TO_CHAR(Approve_Time, 'DD-Mon HH24:MI')             AS "Approved Time",
  tat_min_rounded                                     AS "TAT (Min)",
  COALESCE(ref_avg_min::varchar, 'N/A')               AS "Ref Avg (Min)",
  COALESCE(ref_max_min::varchar, 'N/A')               AS "Ref Max (Min)",
  tito                                                AS "TI/TO",
  CASE WHEN pct_over_avg IS NOT NULL
       THEN '+' || pct_over_avg || '% over avg'
       ELSE NULL
  END                                                 AS "Over Avg Target",
  1 AS Sort_Order

FROM Raw_Data_Calc

UNION ALL

-- 2. PANEL SUMMARY ROWS
SELECT
  DDepartment,
  '---'                                               AS Accession_No,
  Panel_Name,
  '>>> PANEL AVG: ' || Panel_Name                     AS "Test / Summary Row",
  COUNT(*)                                            AS "Tests in Sample",
  '---'                                               AS "Collected Time",
  '---'                                               AS "Approved Time",
  ROUND(AVG(diff_minutes)::numeric, 2)                AS "TAT (Min)",
  -- Avg of the ref values across tests in the panel
  ROUND(AVG(ref_avg_min)::numeric, 1)::varchar        AS "Ref Avg (Min)",
  ROUND(AVG(ref_max_min)::numeric, 1)::varchar        AS "Ref Max (Min)",
  -- Panel-level TI/TO based on panel avg TAT vs avg ref_max
  CASE
    WHEN AVG(ref_max_min) IS NULL THEN 'No Ref'
    WHEN ROUND(AVG(diff_minutes)::numeric, 2) <= ROUND(AVG(ref_max_min)::numeric, 1) THEN 'TI'
    ELSE 'TO'
  END                                                 AS "TI/TO",
  -- Panel-level % over avg if TO
  CASE
    WHEN AVG(ref_max_min) IS NOT NULL
     AND AVG(ref_avg_min) IS NOT NULL
     AND AVG(ref_avg_min) > 0
     AND ROUND(AVG(diff_minutes)::numeric, 2) > ROUND(AVG(ref_max_min)::numeric, 1)
    THEN '+' || ROUND(
           ((ROUND(AVG(diff_minutes)::numeric, 2) - AVG(ref_avg_min)) / AVG(ref_avg_min)) * 100,
           1
         )::varchar || '% over avg'
    ELSE NULL
  END                                                 AS "Over Avg Target",
  2 AS Sort_Order

FROM Raw_Data
GROUP BY DDepartment, Panel_Name

UNION ALL

-- 3. DEPARTMENT SUMMARY ROWS
SELECT
  DDepartment,
  '==='                                               AS Accession_No,
  'TOTAL DEPT'                                        AS Panel_Name,
  '*** DEPT AVG: ' || DDepartment                     AS "Test / Summary Row",
  COUNT(*)                                            AS "Tests in Sample",
  '==='                                               AS "Collected Time",
  '==='                                               AS "Approved Time",
  ROUND(AVG(diff_minutes)::numeric, 2)                AS "TAT (Min)",
  ROUND(AVG(ref_avg_min)::numeric, 1)::varchar        AS "Ref Avg (Min)",
  ROUND(AVG(ref_max_min)::numeric, 1)::varchar        AS "Ref Max (Min)",
  CASE
    WHEN AVG(ref_max_min) IS NULL THEN 'No Ref'
    WHEN ROUND(AVG(diff_minutes)::numeric, 2) <= ROUND(AVG(ref_max_min)::numeric, 1) THEN 'TI'
    ELSE 'TO'
  END                                                 AS "TI/TO",
  CASE
    WHEN AVG(ref_max_min) IS NOT NULL
     AND AVG(ref_avg_min) IS NOT NULL
     AND AVG(ref_avg_min) > 0
     AND ROUND(AVG(diff_minutes)::numeric, 2) > ROUND(AVG(ref_max_min)::numeric, 1)
    THEN '+' || ROUND(
           ((ROUND(AVG(diff_minutes)::numeric, 2) - AVG(ref_avg_min)) / AVG(ref_avg_min)) * 100,
           1
         )::varchar || '% over avg'
    ELSE NULL
  END                                                 AS "Over Avg Target",
  3 AS Sort_Order

FROM Raw_Data
GROUP BY DDepartment

ORDER BY DDepartment, Panel_Name, Sort_Order, Accession_No;