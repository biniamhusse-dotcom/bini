$env:PGPASSWORD="6h5Q4W4gPC"

# Only fetch Dagu items for the 49 products that have EMR matches
$products49 = @(
  "Acetylsalicylic Acid","Acyclovir","Albendazole","Allopurinol","Amitriptyline","Amlodipine",
  "Amoxicillin","Artesunate","Atenolol","Azithromycin","Betamethasone","Bisacodyl",
  "Calcium Gluconate","Carbamazepine","Cefadroxil","Cefixime","Ceftazidime","Ceftriaxone",
  "Chlorpheniramine Maleate","Ciprofloxacin","Clotrimazole","Dexamethasone","Diazepam",
  "Doxycycline","Erythromycin","Fluconazole","Folic Acid","Gentamicin","Griseofulvin",
  "Hydrochlorothiazide","Hydrocortisone","Ibuprofen","Insulin Isophane Human","Levonorgestrel",
  "Mebendazole","Metformin","Methyldopa","Metronidazole","Misoprostol","Nifedipine",
  "Oral Rehydration Salt","Oxytocin","Paracetamol","Potassium Chloride","Praziquantel",
  "Prednisolone","Spironolactone","Vitamin A","Zinc Sulphate"
)

$prodList = ($products49 | ForEach-Object { "'$_'" }) -join ","
$sql = @"
SELECT p.name AS product, COALESCE(d.name,'') AS dosage, COALESCE(s.name,'') AS strength,
       u.name AS unit, iu.rowguid::text AS uuid
FROM item.product p
JOIN item.item i ON i.product_id = p.id
JOIN item.item_unit iu ON iu.item_id = i.id
LEFT JOIN item.dosage d ON i.dosage_id = d.id
LEFT JOIN item.strength s ON i.strength_id = s.id
JOIN item.unit u ON iu.unit_id = u.id
WHERE iu.is_active = true AND d.name IS NOT NULL
  AND p.name IN ($prodList)
ORDER BY p.name, s.name, d.name;
"@

$daguRaw = & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -A -F "`t" -c $sql 2>$null

$daguItems = @()
foreach ($line in ($daguRaw -split "`n" | Where-Object { $_ -ne '' })) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 5) {
    $daguItems += @{
      product = $parts[0].Trim()
      dosage = $parts[1].Trim()
      strength = $parts[2].Trim()
      unit = $parts[3].Trim()
      uuid = $parts[4].Trim()
    }
  }
}
Write-Output "Dagu items loaded: $($daguItems.Count)"

# Get existing mappings so we don't reassign
$existingMappings = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
SELECT openmrs_drug_id, dagu_item_uuid FROM eapts_drug_mapping;
" 2>&1 | Where-Object { $_ -match '^\d' }

$existingDrugIds = @{}
$existingUuids = @{}
foreach ($line in $existingMappings) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2) {
    $existingDrugIds[[int]$parts[0]] = $true
    $existingUuids[$parts[1]] = $true
  }
}
Write-Output "Existing mappings: $($existingDrugIds.Count)"

# Group Dagu items by product name (lowercase)
$daguByProduct = @{}
foreach ($di in $daguItems) {
  $key = $di.product.ToLower().Trim()
  if (-not $daguByProduct.ContainsKey($key)) { $daguByProduct[$key] = @() }
  $daguByProduct[$key] += $di
}
Write-Output "Unique Dagu products: $($daguByProduct.Count)"

# Known product name aliases (EMR name -> Dagu product name)
$productAliases = @{
  'co-trimoxazole' = 'sulphamethoxazole + trimethoprim'
  'cotrimoxazole' = 'sulphamethoxazole + trimethoprim'
}

# Extract key words from drug name (remove numbers, units, common suffixes)
function Get-Keywords {
  param([string]$name)
  $tokens = ($name.ToLower() -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ').Trim() -split '\s+'
  $stopWords = @('mg','g','ml','%','iu','tab','tablet','tab.','cap','capsule','cap.','inj','injection','vial',
                 'susp','suspension','syrup','cream','ointment','drops','solution','suppository','mixture',
                 'powder','inhaler','implant','in','per','with','and','plus','or','the','a','an')
  return $tokens | Where-Object { $_ -ne '' -and $stopWords -notcontains $_ -and $_ -notmatch '^\d+\.?\d*$' }
}

# Parse strength from drug name
function Get-StrengthMg {
  param([string]$name)
  $name = $name.Trim()
  if ($name -match '(\d+\.?\d*)\s*mg\s*\+\s*(\d+\.?\d*)\s*mg') {
    return @{ mg = [double]$matches[1] + [double]$matches[2]/1000; p1 = [double]$matches[1]; p2 = [double]$matches[2]; compound = $true }
  }
  if ($name -match '(\d+\.?\d*)\s*g\b(?!ram)') {
    return @{ mg = [double]$matches[1] * 1000; compound = $false }
  }
  if ($name -match '(\d+\.?\d*)\s*mg') {
    return @{ mg = [double]$matches[1]; compound = $false }
  }
  if ($name -match '(\d+\.?\d*)\s*ml') {
    return @{ mg = [double]$matches[1]; isMl = $true; compound = $false }
  }
  if ($name -match '(\d+\.?\d*)%') {
    return @{ mg = [double]$matches[1]; pct = $true; compound = $false }
  }
  if ($name -match '(\d+\.?\d*)\s*IU') {
    return @{ mg = [double]$matches[1]; iu = $true; compound = $false }
  }
  return @{ mg = -1; compound = $false }
}

# Parse Dagu strength
function Get-DaguStrengthMg {
  param([string]$s)
  if ($s -eq '') { return @{ mg = -1 } }
  if ($s -match '\(?(\d+\.?\d*)\s*mg\s*\+\s*(\d+\.?\d*)\s*mg') {
    return @{ mg = [double]$matches[1] + [double]$matches[2]/1000; p1 = [double]$matches[1]; p2 = [double]$matches[2]; compound = $true }
  }
  if ($s -match '(\d+\.?\d*)\s*mg\s*/\s*ml') {
    return @{ mg = [double]$matches[1]; perMl = $true }
  }
  if ($s -match '(\d+\.?\d*)\s*g\b(?!ram)') {
    return @{ mg = [double]$matches[1] * 1000 }
  }
  if ($s -match '(\d+\.?\d*)\s*mg') {
    return @{ mg = [double]$matches[1] }
  }
  if ($s -match '(\d+\.?\d*)\s*ml') {
    return @{ mg = [double]$matches[1]; isMl = $true }
  }
  if ($s -match '(\d+\.?\d*)%') {
    return @{ mg = [double]$matches[1]; pct = $true }
  }
  if ($s -match '(\d+\.?\d*),?\d*\s*IU') {
    return @{ mg = [double]$matches[1] -replace ',', ''; iu = $true }
  }
  return @{ mg = -1 }
}

# Determine dosage form
function Get-Form {
  param([string]$name)
  $n = $name.ToLower()
  if ($n -match '\b(injection|injectable|inj\.?|vial|ampoule|ampule|intravenous|intramuscular|subcutaneous|infusion)\b') { return "inj" }
  if ($n -match '\b(suspension|syrup|elixir|mixture|mixt\.?|oral solution|oral liquid)\b') { return "liquid" }
  if ($n -match '\b(tablet|tab\.?)\b') { return "tab" }
  if ($n -match '\b(capsule|cap\.?|caplet)\b') { return "cap" }
  if ($n -match '\b(cream|ointment|lotion|gel|paste)\b') { return "topical" }
  if ($n -match '\b(eye|ear|nasal|otic|ophthalmic|drop)\b') { return "topical" }
  if ($n -match '\b(suppository|pessary)\b') { return "supp" }
  if ($n -match '\b(powder|granule|sachet)\b') { return "powder" }
  if ($n -match '\b(inhaler|inhalation|nebuliser|aerosol)\b') { return "inh" }
  if ($n -match '\b(impla|implant|rod)\b') { return "implant" }
  return ""
}

# Get all EMR drugs
$emrRaw = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
SELECT drug_id, name FROM drug ORDER BY drug_id;
" 2>&1 | Where-Object { $_ -match '^\d' }

$emrDrugs = @()
foreach ($line in $emrRaw) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2 -and $parts[0] -match '^\d+$') {
    $name = $parts[1]
    $emrDrugs += @{
      id = [int]$parts[0]
      name = $name
      keywords = Get-Keywords $name
      strength = Get-StrengthMg $name
      form = Get-Form $name
    }
  }
}
Write-Output "EMR drugs: $($emrDrugs.Count)"

# Now match
$usedUuids = @{}
$existingUuids.Keys | ForEach-Object { $usedUuids[$_] = $true }

$ok = @()
$collision = @()
$weak = @()
$unmatched = @()

foreach ($emr in $emrDrugs) {
  if ($existingDrugIds.ContainsKey($emr.id)) {
    continue  # already mapped
  }

  # Find matching Dagu product
  $bestMatch = $null
  $bestScore = -1

  # Check each Dagu product
  foreach ($dkey in $daguByProduct.Keys) {
    $emrWords = $emr.keywords
    $daguWords = ($dkey -split '\s+') | Where-Object { $_ -ne '' }

    # Check if any EMR keyword is in Dagu product name (or vice versa)
    $sharedWords = $emrWords | Where-Object { $daguWords -contains $_ }
    $commonCount = @($sharedWords).Count

    if ($commonCount -eq 0) {
      # Check aliases
      if ($productAliases.ContainsKey($dkey)) {
        $aliasWords = $productAliases[$dkey] -split '\s+' | Where-Object { $_ -ne '' }
        $sharedWords = $emrWords | Where-Object { $aliasWords -contains $_ }
        $commonCount = @($sharedWords).Count
      }
    }

    if ($commonCount -eq 0) { continue }

    # Consider it a match if any keywords overlap
    $items = $daguByProduct[$dkey]

    foreach ($item in $items) {
      $score = 0

      # +30 for overlapping keyword
      $score += 30 * $commonCount

      # Strength matching
      $dagStr = Get-DaguStrengthMg $item.strength
      $emrStr = $emr.strength

      if ($dagStr.mg -gt 0 -and $emrStr.mg -gt 0) {
        $diff = [Math]::Abs($dagStr.mg - $emrStr.mg)
        if ($dagStr.compound -and $emrStr.compound) {
          if ($dagStr.p1 -and $emrStr.p1 -and [Math]::Abs($dagStr.p1 - $emrStr.p1) -lt 1 -and [Math]::Abs($dagStr.p2 - $emrStr.p2) -lt 1) {
            $score += 200  # exact compound match
          } elseif ($diff -lt 1) {
            $score += 150
          } else {
            $score -= 50  # compound doesn't match at all
          }
        } elseif ($diff -lt 0.1) {
          $score += 200  # exact strength match
        } elseif ($diff -lt 5) {
          $score += 150
        } elseif ($diff -lt 50) {
          $score += 50
        } else {
          $score -= 30  # strength mismatch
        }
      }

      # Dosage form matching
      $dagForm = Get-Form ($item.dosage + " " + $item.strength + " " + $item.unit)
      $emrForm = $emr.form

      if ($emrForm -ne '' -and $dagForm -ne '') {
        if ($emrForm -eq $dagForm) {
          $score += 100
        } else {
          $score -= 50
        }
      }

      # Prefer common unit names (Tablet, Ampoule, Vial) over bulk packaging
      if ($item.unit -match '^(Tablet|Ampoule|Vial|Capsule|Bottle|Tube|Suppository)$') {
        $score += 30
      }

      if ($score -gt $bestScore) {
        $bestScore = $score
        $bestMatch = $item
      }
    }
  }

  if ($bestMatch -ne $null) {
    $entry = @{
      drug_id = $emr.id
      drug_name = $emr.name
      dagu_product = $bestMatch.product
      dagu_uuid = $bestMatch.uuid
      dagu_strength = $bestMatch.strength
      dagu_dosage = $bestMatch.dosage
      score = $bestScore
    }

    if ($bestScore -ge 150) {
      if ($usedUuids.ContainsKey($bestMatch.uuid)) {
        $collision += $entry
      } else {
        $ok += $entry
        $usedUuids[$bestMatch.uuid] = $true
      }
    } elseif ($bestScore -ge 80) {
      $weak += $entry
    } else {
      $unmatched += $emr
    }
  } else {
    $unmatched += $emr
  }
}

Write-Output "`n=== RESULTS ==="
Write-Output "OK (unique, score>=150): $($ok.Count)"
Write-Output "Weak (score 80-149): $($weak.Count)"
Write-Output "Collisions: $($collision.Count)"
Write-Output "Untouched: $(($emrDrugs.Count - $ok.Count - $weak.Count - $collision.Count))"

Write-Output "`n=== OK MATCHES ==="
$ok | Sort-Object drug_id | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) -> $($_.dagu_product) | $($_.dagu_strength) $($_.dagu_dosage) [$($_.dagu_uuid)] score=$($_.score)"
}

Write-Output "`n=== WEAK/QUESTIONABLE ==="
$weak | Sort-Object drug_id | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) -> $($_.dagu_product) | $($_.dagu_strength) $($_.dagu_dosage) [$($_.dagu_uuid)] score=$($_.score)"
}

Write-Output "`n=== COLLISIONS (same UUID, different EMR drugs) ==="
$collision | Sort-Object drug_id | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) -> $($_.dagu_uuid)"
}

# Generate SQL for OK matches
Write-Output "`n=== SQL GENERATED ==="
$ok | Sort-Object drug_id | ForEach-Object {
  $nameClean = ($_.drug_name -replace "'", "''")
  $prodClean = ($_.dagu_product -replace "'", "''")
  $strengthClean = ($_.dagu_strength -replace "'", "''")
  $dosageClean = ($_.dagu_dosage -replace "'", "''")
  $desc = "$prodClean $strengthClean $dosageClean".Trim()
  Write-Output "INSERT INTO eapts_drug_mapping (openmrs_drug_id, dagu_item_uuid, dagu_item_name, created_at) VALUES ($($_.drug_id), '$($_.dagu_uuid)', '$desc', NOW()) ON DUPLICATE KEY UPDATE dagu_item_uuid=VALUES(dagu_item_uuid), dagu_item_name=VALUES(dagu_item_name), created_at=NOW();"
}
