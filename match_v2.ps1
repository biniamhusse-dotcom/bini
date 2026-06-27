# Improved matching v2: match by generic name + strength + dosage form
$env:PGPASSWORD="6h5Q4W4gPC"

function Normalize($text) { return ($text.ToLower() -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ').Trim() }

function ExtractStrength($drugName) {
  $norm = Normalize $drugName
  # Match patterns like "500 mg", "500mg", "10 mg/ml", "0.5%", "250mg/5ml", etc.
  $patterns = @(
    '(\d+[\s]*mg[\s]*/[\s]*\d+[\s]*(?:mg|ml))',  # 250mg/5ml
    '(\d+[\s]*mg[\s]*/[\s]*ml)',                    # 10 mg/ml
    '(\d+[\s]*g)',                                   # 1 g
    '(\d+[\s]*mcg)',                                 # 100 mcg
    '(\d+[\s]*mcg/ml)',                              # 50 mcg/ml
    '([\d.]+[\s]*%)',                                # 0.5%
    '(\d+[\s]*mg)',                                  # 500 mg
    '(\d+[\s]*ml)',                                  # 5 ml
    '(\d+[\s]*g/ml)',                                # 
    '(\d+[\s]*IU[\s]*/[\s]*ml)',                     # 5000 IU/ml
    '(\d+[\s]*IU)',                                  # 5000 IU
    '([\d.]+[\s]*lac)',                              # 6 lac
    '(\d+[\s]*)'                                     # just number
  )
  foreach ($p in $patterns) {
    if ($norm -match $p) { return $matches[1] -replace '\s+', '' }  # normalize spacing
  }
  return ""
}

function ExtractDosageFormKeywords($name) {
  $norm = Normalize $name
  $forms = @('tablet', 'capsule', 'injection', 'syrup', 'cream', 'ointment', 'solution',
    'suspension', 'drop', 'drops', 'suppository', 'powder', 'gel', 'lotion', 'elixir',
    'inhalation', 'spray', 'aerosol', 'paste', 'disc', 'implant', 'ring', 'patch')
  $found = @()
  foreach ($f in $forms) {
    if ($norm -match $f) { $found += $f }
  }
  return $found
}

# Export Dagu drug-like items with match keys
$daguRaw = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -A -F "`t" -c "
SELECT p.name,
       COALESCE(d.name, '') AS dosage,
       COALESCE(s.name, '') AS strength,
       u.name AS unit,
       iu.rowguid::text AS uuid
FROM item.product p
JOIN item.item i ON i.product_id = p.id
JOIN item.item_unit iu ON iu.item_id = i.id
LEFT JOIN item.dosage d ON i.dosage_id = d.id
LEFT JOIN item.strength s ON i.strength_id = s.id
JOIN item.unit u ON iu.unit_id = u.id
WHERE iu.is_used = true AND d.name IS NOT NULL
ORDER BY p.name, d.name, s.name;
" 2>&1 | Select-Object -Skip 2

$daguItems = @()
foreach ($line in $daguRaw) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 5) {
    $product = $parts[0]
    $dosage = $parts[1]
    $strength = $parts[2]
    $unit = $parts[3]
    $uuid = $parts[4]
    
    # Compute canonical name
    $strengthClean = $strength -replace '\s+', ''
    $dosageWords = ExtractDosageFormKeywords $dosage
    $dosageKey = if ($dosageWords.Count -gt 0) { $dosageWords[0] } else { Normalize $dosage }
    
    $daguItems += [PSCustomObject]@{
      product = $product
      dosage = $dosage
      strength = $strength
      strength_clean = $strengthClean
      unit = $unit
      uuid = $uuid
      product_norm = Normalize $product
      dosage_key = $dosageKey
    }
  }
}

Write-Output "Dagu items: $($daguItems.Count)"

# Build Dagu index: by generic name
$daguByName = @{}
foreach ($item in $daguItems) {
  $key = $item.product_norm
  if (-not $daguByName.ContainsKey($key)) { $daguByName[$key] = @() }
  $daguByName[$key] += $item
}

# Also index by strength code for cross-reference
$daguByStrength = @{}
foreach ($item in $daguItems) {
  $key = $item.product_norm + "|" + $item.strength_clean
  if (-not $daguByStrength.ContainsKey($key)) { $daguByStrength[$key] = @() }
  $daguByStrength[$key] += $item
}

# Export OpenMRS drugs
$emrRaw = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
SELECT drug_id, name, uuid FROM drug ORDER BY drug_id;
" 2>&1 | Select-String -NotMatch "mysql: \[Warning\]"

$emrDrugs = @()
foreach ($line in $emrRaw) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 3 -and $parts[0] -match '^\d+$') {
    $emrDrugs += [PSCustomObject]@{
      drug_id = [int]$parts[0]
      name = $parts[1]
      uuid = $parts[2]
    }
  }
}
Write-Output "OpenMRS drugs: $($emrDrugs.Count)"

# Improved matching function
function FindBestMatch($drugName) {
  $norm = Normalize $drugName
  $strength = ExtractStrength $drugName
  $dosageKeywords = ExtractDosageFormKeywords $drugName
  $genericWords = ($norm -split '\s+' | Where-Object { $_ -notmatch '^[\d.]+' -and $_ -notmatch '^[\d.]+(mg|ml|g|mcg|iu|%|unit)$' -and $_.Length -ge 3 })
  
  if ($genericWords.Count -eq 0) { return $null }
  
  # Try exact product name match first
  $productKey = $genericWords[0]
  
  $candidates = @()
  # Find Dagu items where product name contains the first generic word
  foreach ($item in $daguItems) {
    if ($item.product_norm -match [regex]::Escape($productKey)) {
      $candidates += $item
    }
  }
  
  if ($candidates.Count -eq 0) { return $null }
  
  # Score candidates
  $best = $null
  $bestScore = -1
  
  foreach ($c in $candidates) {
    $score = 0
    
    # Strength match (most important)
    if ($strength -ne '' -and $c.strength_clean -ne '') {
      $sNorm = $strength -replace '[\s/]', ''
      $cNorm = $c.strength_clean -replace '[\s/]', ''
      if ($sNorm -eq $cNorm) {
        $score += 10  # exact strength match
      } elseif ($sNorm -match [regex]::Escape($cNorm) -or $cNorm -match [regex]::Escape($sNorm)) {
        $score += 5   # partial strength match
      }
    }
    
    # Dosage form match
    foreach ($dk in $dosageKeywords) {
      $dForm = ($c.dosage -replace '_', '') -replace '\s+', ''
      $dkForm = $dk -replace '\s+', ''
      if ($dForm -match [regex]::Escape($dkForm) -or $dkForm -match [regex]::Escape($dForm)) {
        $score += 3
      }
    }
    
    # Product name word overlap
    $prodWords = $c.product_norm -split '\s+'
    foreach ($gw in $genericWords) {
      if ($prodWords -contains $gw) { $score += 1 }
    }
    
    if ($score -gt $bestScore) {
      $bestScore = $score
      $best = $c
    }
  }
  
  # Only return if score >= threshold (exact strength match or very good partial)
  if ($bestScore -ge 10) {
    return @{ item = $best; score = $bestScore }
  }
  return $null
}

# Match
$goodMatches = @()  # score >= 10 (exact strength match)
$partialMatches = @()  # score 5-9 (decent but not perfect)
$noMatches = @()

foreach ($drug in $emrDrugs) {
  $result = FindBestMatch $drug.name
  if ($result -ne $null) {
    $entry = [PSCustomObject]@{
      drug_id = $drug.drug_id
      drug_name = $drug.name
      dagu_product = $result.item.product
      dagu_dosage = $result.item.dosage
      dagu_strength = $result.item.strength
      dagu_uuid = $result.item.uuid
      score = $result.score
    }
    if ($result.score -ge 10) {
      $goodMatches += $entry
    } else {
      $partialMatches += $entry
    }
  } else {
    $noMatches += [PSCustomObject]@{ drug_id = $drug.drug_id; name = $drug.name }
  }
}

Write-Output "`n=== MATCH RESULTS ==="
Write-Output "Good matches (exact strength, score>=10): $($goodMatches.Count)"
Write-Output "Partial matches (score 5-9): $($partialMatches.Count)"
Write-Output "No match: $($noMatches.Count)"

# Check for duplicate Dagu UUIDs in good matches
$dupeGroups = $goodMatches | Group-Object dagu_uuid | Where-Object { $_.Count -gt 1 }
if ($dupeGroups.Count -gt 0) {
  Write-Output "`nWARNING: $($dupeGroups.Count) Dagu UUIDs have multiple OpenMRS drug matches:"
  foreach ($g in $dupeGroups) {
    Write-Output "  UUID $($g.Name):"
    foreach ($m in $g.Group) { Write-Output "    drug_id=$($m.drug_id) `"$($m.drug_name)`" → `"$($m.dagu_product) $($m.dagu_strength) $($m.dagu_dosage)`"" }
  }
}

# Show some good matches for verification
Write-Output "`n=== SAMPLE GOOD MATCHES ==="
foreach ($m in $goodMatches | Select-Object -First 20) {
  Write-Output "  drug_id=$($m.drug_id) `"$($m.drug_name)`" → `"$($m.dagu_product) $($m.dagu_strength) $($m.dagu_dosage)`" (score=$($m.score))"
}

# Show unmatched
Write-Output "`n=== UNMATCHED SAMPLES ==="
foreach ($nm in $noMatches | Select-Object -First 20) {
  Write-Output "  drug_id=$($nm.drug_id) `"$($nm.name)`""
}

# Generate deduplicated SQL
$seenUuids = @{}
$sqlMappings = @()
$sqlUpdates = @()

foreach ($m in $goodMatches) {
  if (-not $seenUuids.ContainsKey($m.dagu_uuid)) {
    $seenUuids[$m.dagu_uuid] = $true
    $sqlUpdates += "UPDATE drug SET uuid = '$($m.dagu_uuid)' WHERE drug_id = $($m.drug_id);"
    $sqlMappings += "  ($($m.drug_id), '$($m.dagu_uuid)', NOW())"
  }
}

$sql = @"
-- Generated by match_v2.ps1
-- Only includes exact-strength matches (score >= 10)
-- 

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE eapts_drug_mapping;

"@

$sql += ($sqlUpdates -join "`n") + "`n`n"
$sql += "INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, created_date) VALUES`n"
$sql += ($sqlMappings -join ",`n") + ";`n`n"
$sql += "SET FOREIGN_KEY_CHECKS = 1;"

$sql | Out-File "C:\Users\COMPUTER\Documents\emr\update_drug_mappings_v2.sql" -Encoding utf8
Write-Output "`nSQL written to: C:\Users\COMPUTER\Documents\emr\update_drug_mappings_v2.sql"
Write-Output "Unique Dagu UUIDs assigned: $($sqlMappings.Count)"
