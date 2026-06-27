$env:PGPASSWORD="6h5Q4W4gPC"

function Parse-StrengthMg {
  param([string]$s)
  $s = $s.Trim()
  if ($s -eq '') { return $null }
  # Compound: (400mg + 80mg) or 400mg+80mg
  if ($s -match '\(?(\d+\.?\d*)\s*mg\s*\+\s*(\d+\.?\d*)\s*mg') {
    return @{ mg = [double]::Parse($matches[1]) + [double]::Parse($matches[2])/1000; compound = $true; p1 = [double]$matches[1]; p2 = [double]$matches[2] }
  }
  # Simple mg
  if ($s -match '^(\d+\.?\d*)\s*mg') {
    return @{ mg = [double]::Parse($matches[1]); compound = $false }
  }
  # g
  if ($s -match '^(\d+\.?\d*)\s*g(?!ram)') {
    return @{ mg = [double]::Parse($matches[1]) * 1000; compound = $false }
  }
  # mg/ml
  if ($s -match '(\d+\.?\d*)\s*mg\s*/\s*(\d+\.?\d*)\s*ml') {
    return @{ mg = [double]::Parse($matches[1]) / [double]::Parse($matches[2]); compound = $false; perMl = $true }
  }
  # Percentage
  if ($s -match '(\d+\.?\d*)%') {
    return @{ mg = [double]::Parse($matches[1]); pct = $true }
  }
  # IU
  if ($s -match '(\d+\.?\d*)\s*IU') {
    return @{ mg = [double]::Parse($matches[1]); iu = $true }
  }
  # ml
  if ($s -match '(\d+\.?\d*)\s*ml') {
    return @{ mg = [double]::Parse($matches[1]); isMl = $true }
  }
  return @{ mg = -1; unknown = $true }
}

function Get-DosageForm {
  param([string]$name)
  $name = $name.ToLower()
  if ($name -match '(suspension|syrup|elixir|mixture|mixt)') { return "liquid_oral" }
  if ($name -match '(injection|injectable|inj\.?\b|vial|ampoule|ampule)') { return "injection" }
  if ($name -match '(eye|ear|nasal|otic|ophthalmic|drops)') { return "topical" }
  if ($name -match '(cream|ointment|lotion|gel|paste)') { return "topical" }
  if ($name -match '(suppository|pessary)') { return "suppository" }
  if ($name -match '(tablet|tab\.?\b|cap\.?\b|capsule|caplet)') { return "oral_solid" }
  if ($name -match '(powder|granule|sachet)') { return "powder" }
  if ($name -match '(inhaler|inhalation|nebuliser|aerosol)') { return "inhalation" }
  if ($name -match '(impla|implant|rod)') { return "implant" }
  return "other"
}

function Get-DosageFormDagu {
  param([string]$dosage)
  $d = $dosage.ToLower().Trim()
  if ($d -match '(suspension|syrup|elixir|mixture|mixt|oral solution|oral liquid)') { return "liquid_oral" }
  if ($d -match '(injection|inj|vial|ampoule|intravenous|intramuscular|subcutaneous|infusion)') { return "injection" }
  if ($d -match '(tablet|tab\.?\b)') { return "oral_solid" }
  if ($d -match '(capsule|cap\.?\b)') { return "oral_solid" }
  if ($d -match '(cream|ointment|lotion|gel|paste|eye|ear|drop)') { return "topical" }
  if ($d -match '(suppository)') { return "suppository" }
  if ($d -match '(powder)') { return "powder" }
  if ($d -match '(implant|rod|impla)') { return "implant" }
  return "other"
}

function Get-NormalizedName {
  param([string]$name)
  return ($name.ToLower() -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ').Trim()
}

# Get all Dagu items for matching products
$daguRaw = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -A -F "`t" -c "
SELECT p.name AS product, COALESCE(d.name,'') AS dosage, COALESCE(s.name,'') AS strength,
       u.name AS unit, iu.rowguid::text AS uuid, iu.is_used
FROM item.product p
JOIN item.item i ON i.product_id = p.id
JOIN item.item_unit iu ON iu.item_id = i.id
LEFT JOIN item.dosage d ON i.dosage_id = d.id
LEFT JOIN item.strength s ON i.strength_id = s.id
JOIN item.unit u ON iu.unit_id = u.id
WHERE iu.is_active = true AND d.name IS NOT NULL
ORDER BY p.name, s.name, d.name, u.name;
" 2>$null

$daguItems = @()
foreach ($line in ($daguRaw -split "`n" | Where-Object { $_ -ne '' })) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 6) {
    $daguItems += @{
      product = $parts[0]
      dosage = $parts[1]
      strength = $parts[2]
      unit = $parts[3]
      uuid = $parts[4]
      is_used = $parts[5] -eq 't'
    }
  }
}

# Get all OpenMRS drugs
$emrRaw = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
SELECT drug_id, name FROM drug ORDER BY drug_id;
" 2>&1 | Where-Object { $_ -match '^\d' }

$emrDrugs = @()
foreach ($line in $emrRaw) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2 -and $parts[0] -match '^\d+$') {
    $emrDrugs += @{ id = [int]$parts[0]; name = $parts[1] }
  }
}

# Group Dagu items by normalized product name
$daguByProduct = @{}
foreach ($di in $daguItems) {
  $key = Get-NormalizedName $di.product
  if (-not $daguByProduct.ContainsKey($key)) { $daguByProduct[$key] = @() }
  $daguByProduct[$key] += $di
}

# Also build alias map for drugs that have different names in Dagu
$aliasMap = @{
  'co-trimoxazole' = 'sulphamethoxazole trimethoprim'
  'cotrimoxazole' = 'sulphamethoxazole trimethoprim'
  'frusemide' = 'furosemide'  # not needed here since Furosemide not in our set
}

# Get existing mappings
$existingMappings = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
SELECT openmrs_drug_id, dagu_item_uuid FROM eapts_drug_mapping;
" 2>&1 | Where-Object { $_ -match '^\d' }

$existingUuids = @{}
$existingDrugIds = @{}
foreach ($line in $existingMappings) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2) {
    $existingDrugIds[[int]$parts[0]] = $true
    $existingUuids[$parts[1]] = $true
  }
}

# Match each EMR drug
$matches = @()
$usedUuids = @{}
$usedUuidsCopy = $existingUuids.Clone()

$drugsToMap = $emrDrugs | Where-Object { -not $existingDrugIds.ContainsKey($_.id) }

foreach ($emr in $drugsToMap) {
  $emrName = $emr.name
  $emrNorm = Get-NormalizedName $emrName
  $emrStrength = Parse-StrengthMg $emrName
  $emrForm = Get-DosageForm $emrName

  # Find best matching Dagu product
  $bestMatch = $null
  $bestScore = 0

  foreach ($dkey in $daguByProduct.Keys) {
    # Check if this Dagu product matches the EMR drug
    $emrWords = $emrNorm -split ' ' | Where-Object { $_ -notmatch '^\d+\.?\d*$|^mg$|^g$|^ml$|^%$|^iu$|^tab$|^tablet$|^cap$|^capsule$|^inj$|^injection$|^vial$|^susp$|^suspension$|^syrup$|^cream$|^ointment$|^drops$|^solution$|^suppository$' -and $_ -ne '' }
    $dkeyWords = $dkey -split ' ' | Where-Object { $_ -ne '' }
    
    $commonWords = @()
    foreach ($w in $emrWords) { if ($dkeyWords -contains $w) { $commonWords += $w } }
    
    $isMatch = $false
    if ($commonWords.Count -ge 2) {
      $isMatch = $true
    } elseif ($commonWords.Count -ge 1 -and ($emrNorm -match $dkey -or $dkey -match $emrNorm)) {
      $isMatch = $true
    }

    if (-not $isMatch) { continue }

    # Found matching product group - find best strength/dosage match
    $items = $daguByProduct[$dkey]
    
    foreach ($item in $items) {
      $score = 0
      $dagStrength = Parse-StrengthMg $item.strength
      $dagForm = Get-DosageFormDagu $item.dosage

      # Strength matching
      if ($emrStrength -ne $null -and $emrStrength.mg -gt 0 -and $dagStrength -ne $null -and $dagStrength.mg -gt 0) {
        $diff = [Math]::Abs($emrStrength.mg - $dagStrength.mg)
        if ($dagStrength.compound -and $emrStrength.compound) {
          # Both compound - check individual parts
          if ($dagStrength.p1 -and $emrStrength.p1) {
            $p1diff = [Math]::Abs($dagStrength.p1 - $emrStrength.p1)
            $p2diff = [Math]::Abs($dagStrength.p2 - $emrStrength.p2)
            if ($p1diff -lt 1 -and $p2diff -lt 1) { $score += 200 }
            elseif ($p1diff -lt 10 -and $p2diff -lt 10) { $score += 100 }
          }
        } else {
          if ($diff -lt 0.1) { $score += 200 }
          elseif ($diff -lt 5) { $score += 150 }
          elseif ($diff -lt 20) { $score += 100 }
          elseif ($diff -lt 100) { $score += 50 }
          elseif ($diff -lt 500) { $score += 10 }
        }
      }

      # Dosage form matching
      if ($emrForm -eq $dagForm -and $emrForm -ne 'other') {
        $score += 100
      } elseif ($emrForm -eq 'other' -or $dagForm -eq 'other') {
        $score += 20
      }

      # Prefer is_used items
      if ($item.is_used) { $score += 30 }

      # Penalise if unit is bulk packaging (1000, 100x10, etc.)
      if ($item.unit -match '^\d+x?\d*$|^\d+$') { $score -= 20 }

      # Boost for exact name match (both names very similar)
      $emrShort = $emrNorm -replace '\s+', ''
      $dkeyShort = $dkey -replace '\s+', ''
      if ($emrShort -eq $dkeyShort) { $score += 50 }

      if ($score -gt $bestScore) {
        $bestScore = $score
        $bestMatch = $item
      }
    }

    # Only check first matching product group
    break
  }

  if ($bestMatch -ne $null -and $bestScore -gt 100) {
    # Check for UUID collision
    if ($usedUuidsCopy.ContainsKey($bestMatch.uuid)) {
      $matches += @{
        drug_id = $emr.id
        drug_name = $emr.name
        dagu_product = $bestMatch.product
        dagu_uuid = $bestMatch.uuid
        dagu_strength = $bestMatch.strength
        dagu_dosage = $bestMatch.dosage
        score = $bestScore
        status = "COLLISION"
      }
    } else {
      $matches += @{
        drug_id = $emr.id
        drug_name = $emr.name
        dagu_product = $bestMatch.product
        dagu_uuid = $bestMatch.uuid
        dagu_strength = $bestMatch.strength
        dagu_dosage = $bestMatch.dosage
        score = $bestScore
        status = "OK"
      }
      $usedUuidsCopy[$bestMatch.uuid] = $true
    }
  } elseif ($bestMatch -ne $null -and $bestScore -gt 50) {
    $matches += @{
      drug_id = $emr.id
      drug_name = $emr.name
      dagu_product = $bestMatch.product
      dagu_uuid = $bestMatch.uuid
      dagu_strength = $bestMatch.strength
      dagu_dosage = $bestMatch.dosage
      score = $bestScore
      status = "WEAK"
    }
  }
}

# Summary
$ok = $matches | Where-Object { $_.status -eq 'OK' }
$weak = $matches | Where-Object { $_.status -eq 'WEAK' }
$coll = $matches | Where-Object { $_.status -eq 'COLLISION' }

Write-Output "OK matches: $($ok.Count)"
Write-Output "Weak matches: $($weak.Count)"
Write-Output "Collisions: $($coll.Count)"
Write-Output "Unmatched: $(($drugsToMap.Count - $matches.Count))"

Write-Output "`n`n=== OK MATCHES (unique UUIDs, score > 100) ==="
$ok | Sort-Object score -Descending | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) -> $($_.dagu_product) [$($_.dagu_strength)] $($_.dagu_dosage) = $($_.dagu_uuid) [score=$($_.score)]"
}

Write-Output "`n`n=== WEAK MATCHES (score 50-100) ==="
$weak | Sort-Object score -Descending | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) -> $($_.dagu_product) [$($_.dagu_strength)] $($_.dagu_dosage) = $($_.dagu_uuid) [score=$($_.score)]"
}

Write-Output "`n`n=== COLLISIONS ==="
$coll | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) -> $($_.dagu_uuid) (already used)"
}

Write-Output "`n`n=== GENERATING SQL ==="
$sql = @"
-- Generated mapping SQL for all verified matches
-- Run: docker exec -i bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs < this_file.sql

"@

$ok | Sort-Object drug_id | ForEach-Object {
  $nameClean = ($_.drug_name -replace "'", "''")
  $prodClean = ($_.dagu_product -replace "'", "''")
  $strengthClean = ($_.dagu_strength -replace "'", "''")
  $dosageClean = ($_.dagu_dosage -replace "'", "''")
  $desc = "$prodClean $strengthClean $dosageClean".Trim()

  $sql += @"
INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at)
VALUES ($($_.drug_id), '$($_.dagu_uuid)', '$desc', NOW())
ON DUPLICATE KEY UPDATE dagu_item_uuid = VALUES(dagu_item_uuid), dagu_item_name = VALUES(dagu_item_name), created_at = NOW();

"@
}

$sqlPath = "$env:TEMP\drug_mappings_v2.sql"
$sql | Out-File -FilePath $sqlPath -Encoding ASCII
Write-Output "SQL written to: $sqlPath"
Write-Output "Total INSERTs: $($ok.Count)"

# Show sample
$ok | Select-Object -First 5 | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) => $($_.dagu_uuid)"
}
