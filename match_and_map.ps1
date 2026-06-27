# Step 1: Export Dagu drug-like items
Write-Output "Exporting Dagu drug-like items..."
$env:PGPASSWORD="6h5Q4W4gPC"
$daguRaw = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -A -F "`t" -c "
SELECT p.name AS product_name,
       COALESCE(d.name, '') AS dosage_form,
       COALESCE(s.name, '') AS strength,
       u.name AS unit,
       iu.rowguid::text AS item_unit_uuid
FROM item.product p
JOIN item.item i ON i.product_id = p.id
JOIN item.item_unit iu ON iu.item_id = i.id
LEFT JOIN item.dosage d ON i.dosage_id = d.id
LEFT JOIN item.strength s ON i.strength_id = s.id
JOIN item.unit u ON iu.unit_id = u.id
WHERE iu.is_used = true AND d.name IS NOT NULL
ORDER BY p.name;
" 2>&1 | Select-Object -Skip 2

$daguItems = @()
foreach ($line in $daguRaw) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 5) {
    $daguItems += [PSCustomObject]@{
      product_name = $parts[0]
      dosage_form = $parts[1]
      strength = $parts[2]
      unit = $parts[3]
      item_unit_uuid = $parts[4]
    }
  }
}
Write-Output "  Dagu drug-like items: $($daguItems.Count)"

# Step 2: Export OpenMRS drugs
Write-Output "Exporting OpenMRS drugs..."
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
Write-Output "  OpenMRS drugs: $($emrDrugs.Count)"

# Step 3: Build Dagu index (normalized product name -> items)
function Normalize($text) {
  return ($text.ToLower() -replace '[^a-z0-9\s]', ' ' -replace '\s+', ' ').Trim()
}

function ExtractGeneric($drugName) {
  $norm = Normalize $drugName
  $skipWords = @('tablet', 'capsule', 'injection', 'syrup', 'cream', 'ointment',
    'solution', 'suspension', 'drop', 'drops', 'with', 'for', 'in', 'per', 'as',
    'enteric', 'coated', 'sustained', 'release', 'film', 'dispersible',
    'oral', 'intravenous', 'intra', 'muscular', 'bp', 'ip')
  $parts = $norm -split '\s+' | Where-Object { $_ -ne '' }
  $generic = @()
  foreach ($p in $parts) {
    if ($p -match '^[\d.,]+' -or $p -match '^[\d.,]+(mg|ml|g|mcg|iu|%|unit)$') { break }
    if ($skipWords -contains $p) { break }
    $generic += $p
  }
  return ($generic -join ' ').Trim()
}

$daguIndex = @{}
foreach ($item in $daguItems) {
  $key = Normalize $item.product_name
  if (-not $daguIndex.ContainsKey($key)) { $daguIndex[$key] = @() }
  $daguIndex[$key] += $item
}

# Also add partial name index
foreach ($item in $daguItems) {
  $name = Normalize $item.product_name
  $words = $name -split '\s+'
  foreach ($w in $words) {
    if ($w.Length -ge 3) {
      $partialKey = "partial:$w"
      if (-not $daguIndex.ContainsKey($partialKey)) { $daguIndex[$partialKey] = @() }
      $daguIndex[$partialKey] += $item
    }
  }
}

# Step 4: Match
function Score-Match($drugName, $daguItem) {
  $drugNorm = Normalize $drugName
  $candNorm = Normalize ($daguItem.product_name + ' ' + $daguItem.strength + ' ' + $daguItem.dosage_form + ' ' + $daguItem.unit)
  $drugWords = ($drugNorm -split '\s+') | Where-Object { $_.Length -gt 1 } | Sort-Object -Unique
  $candWords = ($candNorm -split '\s+') | Where-Object { $_.Length -gt 1 } | Sort-Object -Unique
  $score = 0
  foreach ($w in $drugWords) { if ($candWords -contains $w) { $score++ } }
  # Check if drug name starts with product name
  if ($drugNorm.StartsWith((Normalize $daguItem.product_name))) { $score += 2 }
  return $score
}

$matches = @()
$noMatches = @()

foreach ($drug in $emrDrugs) {
  $generic = ExtractGeneric $drug.name
  $key = Normalize $generic
  
  $candidates = @()
  if ($daguIndex.ContainsKey($key)) { $candidates += $daguIndex[$key] }
  
  if ($candidates.Count -eq 0) {
    # Try partial match
    $words = $key -split '\s+'
    foreach ($w in $words) {
      if ($w.Length -ge 3 -and $daguIndex.ContainsKey("partial:$w")) {
        $candidates += $daguIndex["partial:$w"]
      }
    }
  }
  
  if ($candidates.Count -gt 0) {
    $candidates = $candidates | Sort-Object -Unique -Property item_unit_uuid
    $best = $candidates[0]
    $bestScore = Score-Match $drug.name $best
    
    foreach ($c in $candidates) {
      $s = Score-Match $drug.name $c
      if ($s -gt $bestScore) { $bestScore = $s; $best = $c }
    }
    
    $matches += [PSCustomObject]@{
      drug_id = $drug.drug_id
      drug_name = $drug.name
      dagu_product = $best.product_name
      dagu_dosage = $best.dosage_form
      dagu_strength = $best.strength
      dagu_uuid = $best.item_unit_uuid
      score = $bestScore
    }
  } else {
    $noMatches += [PSCustomObject]@{
      drug_id = $drug.drug_id
      name = $drug.name
      generic = $generic
    }
  }
}

Write-Output "`nMatched: $($matches.Count)"
Write-Output "Unmatched: $($noMatches.Count)"

# Stats
$scoreGroups = $matches | Group-Object { if ($_.score -ge 5) { "5+" } elseif ($_.score -ge 3) { "3-4" } else { "0-2" } }
Write-Output "`nMatch score distribution:"
foreach ($g in $scoreGroups) { Write-Output "  Score $($g.Name): $($g.Count)" }

# Step 5: Check duplicates
$dupeGroups = $matches | Group-Object dagu_uuid | Where-Object { $_.Count -gt 1 }
if ($dupeGroups.Count -gt 0) {
  Write-Output "`nWARNING: Duplicate Dagu UUID assignments:"
  foreach ($g in $dupeGroups) {
    Write-Output "  UUID $($g.Name):"
    foreach ($m in $g.Group) { Write-Output "    drug_id=$($m.drug_id) `"$($m.drug_name)`" (score=$($m.score))" }
  }
}

# Step 6: Generate SQL
$sql = @"
-- Generated by match_and_map.ps1
-- Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
--
-- This script:
-- 1. Updates OpenMRS drug UUIDs to match Dagu item_unit UUIDs
-- 2. Creates eapts_drug_mapping entries for all matched drugs
--

SET FOREIGN_KEY_CHECKS = 0;

-- Clear existing mappings
TRUNCATE TABLE eapts_drug_mapping;

-- Update drug UUIDs
"@

foreach ($m in $matches) {
  $sql += "`nUPDATE drug SET uuid = '$($m.dagu_uuid)' WHERE drug_id = $($m.drug_id);"
}

$sql += @"

-- Insert mappings
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, created_date) VALUES
"@

$valueLines = @()
foreach ($m in $matches) {
  $valueLines += "  ($($m.drug_id), '$($m.dagu_uuid)', NOW())"
}
$sql += ($valueLines -join ",`n") + ";"

$sql += @"

-- Update sequence
SET FOREIGN_KEY_CHECKS = 1;
"@

# Write SQL to file
$sql | Out-File -FilePath "C:\Users\COMPUTER\Documents\emr\update_drug_mappings.sql" -Encoding utf8
Write-Output "`nSQL written to: C:\Users\COMPUTER\Documents\emr\update_drug_mappings.sql"

# Step 7: Show unmatched
if ($noMatches.Count -gt 0) {
  Write-Output "`n=== UNMATCHED DRUGS (first 30) ==="
  foreach ($nm in $noMatches | Select-Object -First 30) {
    Write-Output "  drug_id=$($nm.drug_id) `"$($nm.name)`" -> generic=`"$($nm.generic)`""
  }
  if ($noMatches.Count -gt 30) { Write-Output "  ... and $($noMatches.Count - 30) more" }
}

Write-Output "`nDone!"
