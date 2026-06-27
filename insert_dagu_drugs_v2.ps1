$env:PGPASSWORD="6h5Q4W4gPC"

# Get Dagu products - only actual drug-like (exclude chemicals, supplies, vaccines, etc.)
$daguRaw = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -A -F "`t" -t -c "
SELECT DISTINCT p.name
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
  AND p.name NOT LIKE '%Dialysis%'
  AND p.name NOT LIKE '%Suture%'
  AND p.name NOT LIKE '%Dressing%'
  AND p.name NOT LIKE '%Cannula%'
  AND p.name NOT LIKE '%Speculum%'
  AND p.name NOT LIKE '%Stethoscope%'
  AND p.name NOT LIKE '%Thermometer%'
  AND p.name NOT LIKE '%Lancet%'
  AND p.name NOT LIKE '%Scalpel%'
  AND p.name NOT LIKE '%Forcep%'
  AND p.name NOT LIKE '%Mask%'
  AND p.name NOT LIKE '%Condom%'
  AND p.name NOT LIKE '%Sanitary%'
  AND p.name NOT LIKE '%Sponge%'
  AND p.name NOT LIKE '%Adhesive%'
  AND p.name NOT LIKE '%Cervical Ripening%'
  AND p.name NOT LIKE '%Intrauterine%'
  AND p.name NOT LIKE 'Fetal Bovine%'
  AND p.name NOT LIKE 'Humalytes%'
ORDER BY p.name;
" 2>$null

$daguAll = @($daguRaw | Where-Object { $_ -ne '' })
Write-Output "Dagu drug-like products (filtered): $($daguAll.Count)"

# Get EMR drug names (normalized)
$emrDrugNames = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "SELECT LOWER(TRIM(name)) FROM drug ORDER BY name;" 2>&1 | Select-String -NotMatch "mysql: \[Warning\]|Using a password"

$emrDrugSet = @{}
$emrDrugList = @()
foreach ($n in $emrDrugNames) {
  $norm = ($n -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ').Trim()
  $emrDrugSet[$norm] = $true
  $emrDrugList += $norm
}
Write-Output "EMR drug names: $($emrDrugList.Count)"

# Check each Dagu product against EMR drugs and concepts
$newDrugs = @()  # Has concept, needs drug entry
$needConcept = @()  # No concept exists
$alreadyMatch = @()  # Already in EMR

$i = 0
foreach ($prod in $daguAll) {
  $i++
  
  $prodNorm = ($prod -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ').Trim().ToLower()
  $prodWords = $prodNorm -split ' ' | Where-Object { $_ -ne '' }
  
  # Check if product name matches any EMR drug name
  $isMatch = $false
  foreach ($edn in $emrDrugList) {
    $edWords = $edn -split ' ' | Where-Object { $_ -ne '' }
    $common = $prodWords | Where-Object { $edWords -contains $_ }
    
    if ($common.Count -ge 2 -or ($prodWords.Count -le 2 -and $common.Count -ge 1)) {
      $isMatch = $true
      break
    }
  }
  
  if ($isMatch) {
    $alreadyMatch += $prod
    continue
  }
  
  # Check for existing concept (efficient single query per batch)
  # We'll do this later - for now just check if it's a genuine drug (not vaccine, not supply)
  $prodLower = $prod.ToLower()
  
  # Skip vaccines
  if ($prodLower -match '\b(vaccine|vaccin)\b') { $needConcept += $prod; continue }
  
  # Get Dagu item_unit UUID for this product
  $prodEscaped = $prod -replace "'", "''"
  $daguUuid = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -t -c "
    SELECT iu.rowguid FROM item.item_unit iu
    JOIN item.item i ON iu.item_id = i.id
    JOIN item.product p ON i.product_id = p.id
    WHERE p.name = '$prodEscaped' AND iu.is_active = true AND iu.is_used = true
    ORDER BY iu.is_used DESC LIMIT 1;
  " 2>$null
  
  if ($daguUuid -match '[a-f0-9]{8}-') {
    $uuid = $daguUuid.Trim()
    
    # Try to find concept for this product
    $result = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
      SELECT c.concept_id FROM concept_name cn 
      JOIN concept c ON cn.concept_id = c.concept_id 
      WHERE cn.name LIKE '%$prodEscaped%' AND cn.locale = 'en' AND cn.concept_name_type = 'FULLY_SPECIFIED' AND c.retired = 0
      LIMIT 1;
    " 2>&1 | Select-String -NotMatch "mysql: \[Warning\]|Using a password"
    
    if ($result -match '^(\d+)') {
      $newDrugs += @{ product = $prod; concept_id = [int]$Matches[1]; dagu_uuid = $uuid }
    } else {
      $needConcept += $prod
    }
  } else {
    $needConcept += $prod
  }
  
  if ($i % 20 -eq 0) { Write-Host "Checked $i of $($daguAll.Count): $($newDrugs.Count) new, $($alreadyMatch.Count) matched, $($needConcept.Count) no concept" }
}

Write-Output "`n=== RESULTS ==="
Write-Output "Already matches EMR drug: $($alreadyMatch.Count)"
Write-Output "Has EMR concept (can insert): $($newDrugs.Count)"
Write-Output "No concept (needs creation): $($needConcept.Count)"

# Generate SQL
Write-Output "`n=== SQL TO INSERT NEW DRUGS ==="
if ($newDrugs.Count -gt 0) {
  Write-Output "START TRANSACTION;"
  foreach ($item in $newDrugs | Sort-Object product) {
    $name = ($item.product -replace "'", "''")
    Write-Output "INSERT INTO drug (concept_id, name, combination, creator, date_created, uuid) VALUES ($($item.concept_id), '$name', 0, 1, NOW(), UUID());"
    Write-Output "SET @did = LAST_INSERT_ID();"
    Write-Output "INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES (@did, '$($item.dagu_uuid)', '$name', NOW());"
  }
  Write-Output "COMMIT;"
}

Write-Output "`n=== PRODUCTS NEEDING CONCEPT CREATION ==="
$needConcept | ForEach-Object { Write-Output "$_" }
