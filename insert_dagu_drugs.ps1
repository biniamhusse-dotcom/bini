# Insert Dagu drug-like products (not in EMR) into OpenMRS
$env:PGPASSWORD="6h5Q4W4gPC"

# Get ALL Dagu products with drug-like dosage forms (not chemicals, not supplies)
$daguRaw = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -A -F "`t" -t -c "
SELECT DISTINCT p.name AS product
FROM item.product p
JOIN item.item i ON i.product_id = p.id
JOIN item.item_unit iu ON iu.item_id = i.id
JOIN item.dosage d ON i.dosage_id = d.id
WHERE iu.is_active = true AND d.name IS NOT NULL
  AND p.name NOT LIKE 'Chemical -%'
  AND p.name NOT LIKE 'Microbiology -%'
  AND p.name NOT LIKE 'Clinical Chemistry -%'
  AND p.name NOT LIKE 'COBAS%'
  AND p.name NOT LIKE 'FACS%'
  AND p.name NOT LIKE 'Blood %'
  AND p.name NOT LIKE '%Bandage%'
  AND p.name NOT LIKE '%Catheter%'
  AND p.name NOT LIKE '%Syringe%'
  AND p.name NOT LIKE '%Glove%'
  AND p.name NOT LIKE '%Gauze%'
  AND p.name NOT LIKE '%Swab%'
  AND p.name NOT LIKE '%Needle%'
  AND p.name NOT LIKE '%Bag%'
  AND p.name NOT LIKE '%Tube%'
  AND p.name NOT LIKE '%Set%'
  AND p.name NOT LIKE '%Humalytes%'
  AND p.name NOT LIKE 'Fetal Bovine%'
  AND p.name NOT LIKE 'Dialysis%'
ORDER BY p.name;
" 2>$null

$daguProducts = @($daguRaw | Where-Object { $_ -ne '' })
Write-Output "Dagu drug-like products (filtered): $($daguProducts.Count)"

# Get all existing EMR drug names (for matching)
$emrDrugNames = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
SELECT LOWER(TRIM(name)) FROM drug;
" 2>&1 | Where-Object { $_ -match '^[a-z]' }

$emrDrugNameSet = @{}
foreach ($n in $emrDrugNames) {
  $emrDrugNameSet[($n -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ').Trim()] = $true
}

# Check each product
$alreadyInEmr = @()
$hasConcept = @()
$noConcept = @()

$i = 0
foreach ($prod in $daguProducts) {
  $i++
  if ($i % 50 -eq 0) { Write-Progress -Activity "Checking Dagu products" -Status "$i of $($daguProducts.Count)" -PercentComplete (($i/$daguProducts.Count)*100) }
  
  $prodNorm = ($prod -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ').Trim().ToLower()
  
  # Check if already in EMR drug table (fuzzy)
  $inEmr = $false
  foreach ($en in $emrDrugNameSet.Keys) {
    $enWords = $en -split ' ' | Where-Object { $_ -ne '' }
    $pw = $prodNorm -split ' ' | Where-Object { $_ -ne '' }
    $common = $pw | Where-Object { $enWords -contains $_ }
    
    if ($common.Count -ge 2 -or ($pw.Count -le 2 -and $common.Count -ge 1)) {
      # Check if it's truly the same drug (not a combination match)
      $pwStr = ($pw -join ' ')
      $enStr = ($enWords -join ' ')
      if ($pwStr -match $enStr -or $enStr -match $pwStr -or ($common.Count -ge 2 -and $pw.Count -le 3)) {
        $inEmr = $true
        break
      }
    }
  }
  
  if ($inEmr) {
    $alreadyInEmr += $prod
    continue
  }
  
  # Check if concept exists
  $prodEscaped = $prod -replace "'", "''"
  $result = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
    SELECT c.concept_id FROM concept_name cn 
    JOIN concept c ON cn.concept_id = c.concept_id 
    WHERE cn.name LIKE '%$prodEscaped%' AND cn.locale = 'en' AND cn.concept_name_type = 'FULLY_SPECIFIED'
    LIMIT 1;
  " 2>&1 | Select-String -NotMatch "mysql: \[Warning\]|Using a password"
  
  if ($result -match '^\d+') {
    $hasConcept += @{ product = $prod; concept_id = [int]$result }
  } else {
    $noConcept += $prod
  }
}

Write-Output "`n=== RESULTS ==="
Write-Output "Already in EMR (by name): $($alreadyInEmr.Count)"
Write-Output "Has concept (can create drug): $($hasConcept.Count)"
Write-Output "No concept (needs concept creation): $($noConcept.Count)"

Write-Output "`n=== PRODUCTS WITH EXISTING CONCEPTS ==="
$hasConcept | Sort-Object product | ForEach-Object { Write-Output "$($_.product) -> concept $($_.concept_id)" }

Write-Output "`n=== PRODUCTS NEEDING NEW CONCEPT ==="
$noConcept | ForEach-Object { Write-Output "$_" }

# Generate SQL for drugs with existing concepts
Write-Output "`n`n=== SQL TO CREATE NEW DRUGS ==="
# Get dosage_form concept for "Tablet" (most common)
$tabDf = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
  SELECT concept_id FROM concept_name WHERE name = 'Tablet' AND locale = 'en' AND concept_name_type = 'FULLY_SPECIFIED' LIMIT 1;
" 2>&1 | Select-String -NotMatch "mysql: \[Warning\]|Using a password"

Write-Output "Tablet dosage_form concept_id: $tabDf"

foreach ($item in $hasConcept | Sort-Object product) {
  $name = ($item.product -replace "'", "''")
  Write-Output "INSERT INTO drug (concept_id, name, combination, creator, date_created, uuid) VALUES ($($item.concept_id), '$name', 0, 1, NOW(), UUID());"
  Write-Output "SET @drug_id = LAST_INSERT_ID();"
  
  # Get Dagu item_unit UUID for this product (prefer is_used, first item)
  $prodEscaped = $item.product -replace "'", "''"
  $daguUuid = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -t -c "
    SELECT iu.rowguid FROM item.item_unit iu
    JOIN item.item i ON iu.item_id = i.id
    JOIN item.product p ON i.product_id = p.id
    WHERE p.name = '$prodEscaped' AND iu.is_active = true AND iu.is_used = true
    ORDER BY iu.is_used DESC LIMIT 1;
  " 2>$null
  
  if ($daguUuid -match '[a-f0-9]{8}-') {
    $uuid = $daguUuid.Trim()
    Write-Output "INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES (@drug_id, '$uuid', '$name', NOW()) ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();"
  }
  Write-Output ""
}
