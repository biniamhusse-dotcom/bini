WITH Raw_Data AS (
  SELECT
    ts.name AS DDepartment,
    s.accession_number AS Accession_No,
    COALESCE(p.name, 'Individual Test') AS Panel_Name,
    t.name AS test_name,
    -- Window function to count how many tests are in this specific Accession
    COUNT(*) OVER (PARTITION BY s.accession_number) AS tests_in_accession,
    s.collection_date AS Collect_Time,
    a.lastupdated AS Approve_Time,
    -- Accurate minutes using the system timestamp
    ABS(EXTRACT(EPOCH FROM (CAST(a.lastupdated AS timestamp) - CAST(s.collection_date AS timestamp))) / 60) AS diff_minutes
  FROM analysis a
    JOIN test t ON a.test_id = t.id
    JOIN test_section ts ON t.test_section_id = ts.id
    JOIN sample_item si ON a.sampitem_id = si.id
    JOIN sample s ON si.samp_id = s.id
    LEFT JOIN panel p ON a.panel_id = p.id
  WHERE a.completed_date IS NOT NULL
    AND CAST(a.completed_date AS DATE) BETWEEN '#startDate#' AND '#endDate#'
)

-- 1. DETAILED TEST ROWS
SELECT 
  DDepartment,
  Accession_No,
  Panel_Name,
  test_name AS "Test / Summary Row",
  tests_in_accession AS "Sample Count",
  TO_CHAR(Collect_Time, 'DD-Mon HH24:MI') AS "Collected Time",
  TO_CHAR(Approve_Time, 'DD-Mon HH24:MI') AS "Approved Time",
  ROUND(diff_minutes::numeric, 2) AS "TAT Minutes",
  1 AS Sort_Order
FROM Raw_Data

UNION ALL

-- 2. PANEL AVERAGE ROWS (Summarizes the Panel)
SELECT 
  DDepartment,
  '---' AS Accession_No,
  Panel_Name,
  '>>> PANEL AVG: ' || Panel_Name AS "Test / Summary Row",
  COUNT(*) AS "Sample Count", -- Total tests performed in this panel group
  '---' AS "Collected Time",
  '---' AS "Approved Time",
  ROUND(AVG(diff_minutes)::numeric, 2) AS "TAT Minutes",
  2 AS Sort_Order
FROM Raw_Data
GROUP BY DDepartment, Panel_Name

UNION ALL

-- 3. DEPARTMENT AVERAGE ROWS (Summarizes the Department)
SELECT 
  DDepartment,
  '===' AS Accession_No,
  'TOTAL DEPT' AS Panel_Name,
  '*** DEPT AVG: ' || DDepartment AS "Test / Summary Row",
  COUNT(*) AS "Sample Count", -- Total tests performed in this department
  '===' AS "Collected Time",
  '===' AS "Approved Time",
  ROUND(AVG(diff_minutes)::numeric, 2) AS "TAT Minutes",
  3 AS Sort_Order
FROM Raw_Data
GROUP BY DDepartment

ORDER BY DDepartment, Panel_Name, Sort_Order, Accession_No;