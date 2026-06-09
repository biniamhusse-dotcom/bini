SELECT 
    `Service Unit`, 
    `Age Group`, 
    `Male`, 
    `Female`, 
    `Other`, 
    `Total`
FROM (
    /* 1. DETAILED AGE BREAKDOWN PER SERVICE UNIT */
    SELECT 
        vt.name AS "Service Unit",
        CASE    
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) < 5 THEN '< 5'
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 5 AND 10 THEN '05-10'  
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 11 AND 19 THEN '11-19'
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 20 AND 29 THEN '20-29'
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 30 AND 45 THEN '30-45'
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 46 AND 65 THEN '46-65'
            ELSE '>=66'   
        END AS "Age Group",
        SUM(IF(p.gender='M', 1, 0)) AS "Male",
        SUM(IF(p.gender='F', 1, 0)) AS "Female",
        SUM(IF(p.gender='O', 1, 0)) AS "Other",
        COUNT(p.person_id) AS "Total",
        1 AS "sort_order", -- Details come first
        CASE 
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) < 5 THEN 1
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 5 AND 10 THEN 2
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 11 AND 19 THEN 3
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 20 AND 29 THEN 4
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 30 AND 45 THEN 5
            WHEN FLOOR(DATEDIFF(DATE(v.date_started), p.birthdate) / 365) BETWEEN 46 AND 65 THEN 6
            ELSE 7 
        END AS "age_sort"
    FROM visit v
    JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
    JOIN person p ON p.person_id = v.patient_id
    WHERE v.visit_type_id NOT IN (16, 15, 19) 
      AND CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    GROUP BY vt.name, `Age Group`

    UNION ALL

    /* 2. SUBTOTAL PER SERVICE UNIT */
    SELECT 
        vt.name AS "Service Unit",
        CONCAT('SUBTOTAL - ', vt.name) AS "Age Group",
        SUM(IF(p.gender='M', 1, 0)) AS "Male",
        SUM(IF(p.gender='F', 1, 0)) AS "Female",
        SUM(IF(p.gender='O', 1, 0)) AS "Other",
        COUNT(p.person_id) AS "Total",
        2 AS "sort_order", -- Subtotal comes second
        99 AS "age_sort"   -- Subtotal comes after all ages
    FROM visit v
    JOIN visit_type vt ON v.visit_type_id = vt.visit_type_id
    JOIN person p ON p.person_id = v.patient_id
    WHERE v.visit_type_id NOT IN (16, 15, 19) 
      AND CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'
    GROUP BY vt.name

    UNION ALL

    /* 3. GRAND TOTAL FOR THE ENTIRE REPORT */
    SELECT 
        '** GRAND TOTAL **',
        '',
        SUM(IF(p.gender='M', 1, 0)) AS "Male",
        SUM(IF(p.gender='F', 1, 0)) AS "Female",
        SUM(IF(p.gender='O', 1, 0)) AS "Other",
        COUNT(p.person_id) AS "Total",
        3 AS "sort_order", 
        100 AS "age_sort"
    FROM visit v
    JOIN person p ON p.person_id = v.patient_id
    WHERE v.visit_type_id NOT IN (16, 15, 19) 
      AND CAST(v.date_created AS DATE) BETWEEN '#startDate#' AND '#endDate#'

) AS final_report
ORDER BY 
    CASE WHEN `Service Unit` = '** GRAND TOTAL **' THEN 1 ELSE 0 END, -- Push Grand Total to bottom
    `Service Unit` ASC, 
    `sort_order` ASC, 
    `age_sort` ASC;