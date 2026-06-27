$env:PGPASSWORD="6h5Q4W4gPC"

# Get Dagu items for the 49 matching products
$products = @(
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

$prodList = ($products | ForEach-Object { "'$_'" }) -join ","

# Save Dagu items to file
& "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -A -F "`t" -c "
SELECT p.name AS product, COALESCE(d.name,'') AS dosage, COALESCE(s.name,'') AS strength, u.name AS unit, iu.rowguid::text AS uuid
FROM item.product p
JOIN item.item i ON i.product_id = p.id
JOIN item.item_unit iu ON iu.item_id = i.id
LEFT JOIN item.dosage d ON i.dosage_id = d.id
LEFT JOIN item.strength s ON i.strength_id = s.id
JOIN item.unit u ON iu.unit_id = u.id
WHERE iu.is_active = true AND d.name IS NOT NULL
  AND p.name IN ($prodList)
ORDER BY p.name, s.name, d.name;
" > "$env:TEMP\dagu_items.tsv" 2>$null

Write-Output "Dagu items: $(@(Get-Content "$env:TEMP\dagu_items.tsv" | Where-Object { $_ -ne '' }).Count) rows"

# Get all OpenMRS drugs with name
$emrRaw = docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs -s -e "
SELECT drug_id, name FROM drug ORDER BY drug_id;
" 2>&1 | Where-Object { $_ -match '^\d' }

# Parse EMR drugs
$emrDrugs = @()
foreach ($line in $emrRaw) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 2 -and $parts[0] -match '^\d+$') {
    $emrDrugs += @{
      id = [int]$parts[0]
      name = $parts[1]
    }
  }
}
Write-Output "EMR drugs: $($emrDrugs.Count)"

# Parse Dagu items
$daguItems = @()
$daguLines = Get-Content "$env:TEMP\dagu_items.tsv" | Where-Object { $_ -ne '' }
foreach ($line in $daguLines) {
  $parts = $line -split "`t"
  if ($parts.Count -ge 5) {
    $daguItems += @{
      product = $parts[0]
      dosage = $parts[1]
      strength = $parts[2]
      unit = $parts[3]
      uuid = $parts[4]
    }
  }
}
Write-Output "Dagu items parsed: $($daguItems.Count)"

# Group Dagu items by product
$daguByProduct = @{}
foreach ($di in $daguItems) {
  $key = $di.product.ToLower().Trim()
  if (-not $daguByProduct.ContainsKey($key)) { $daguByProduct[$key] = @() }
  $daguByProduct[$key] += $di
}

# Matching logic - normalize names and match by strength/dosage
function Get-StrengthMg {
  param([string]$name)
  $s = 0
  if ($name -match '(\d+\.?\d*)\s*(?:mg|g)\s*\+\s*(\d+\.?\d*)\s*mg') {
    # Compound drug like "400 mg + 80 mg"
    $s = [double]::Parse($matches[1]) + [double]::Parse($matches[2])/1000
  } elseif ($name -match '(\d+\.?\d*)\s*(?:mg|g)') {
    $val = [double]::Parse($matches[1])
    if ($name -match '(\d+\.?\d*)\s*g') {
      $s = $val * 1000
    } else {
      $s = $val
    }
  }
  return $s
}

function Get-DosageForm {
  param([string]$name)
  if ($name -match '(Suspension|Syrup|Elixir|Mixture|Mixt\.?)') { return "suspension" }
  if ($name -match '(Tablet|Tab\.?\b|Cap\.?\b|Capsule|Caplet)') { return "tablet" }
  if ($name -match '(Injection|Inj\b|Vial|Ampoule|Ampule)') { return "injection" }
  if ($name -match '(Cream|Ointment|Lotion|Gel)') { return "topical" }
  if ($name -match '(Eye|Ear|Nasal|Ophthalmic|Otic)') { return "topical" }
  if ($name -match '(Suppository|Pessary)') { return "suppository" }
  if ($name -match '(Inhaler|Inhalation|Nebuliser)') { return "inhalation" }
  return "other"
}

# For each EMR drug, try to find best Dagu match
$matched = @()
$unmatched = @()

foreach ($emr in $emrDrugs) {
  $emrName = $emr.name.ToLower().Trim()
  $emrNorm = $emrName -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' ' -replace '(tab|tablet|cap|capsule|inj|injection|susp|suspension|vial|cream|ointment|syrup|mixture|drops|solution|foam|gel|powder|spray|patch)', '' -replace '\s+', ' '
  $emrStrength = Get-StrengthMg $emr.name
  $emrForm = Get-DosageForm $emr.name

  $found = $false
  $bestMatch = $null

  # Find matching Dagu product
  foreach ($dkey in $daguByProduct.Keys) {
    # Check if EMR name contains Dagu product name (or vice versa)
    $dkeyNorm = $dkey -replace '[^a-z0-9\s/]', ' ' -replace '\s+', ' '
    $emrWords = $emrNorm -split ' '
    $dkeyWords = $dkeyNorm -split ' '
    $common = $emrWords | Where-Object { $_ -ne '' -and $dkeyWords -contains $_ }

    if ($common.Count -ge 2 -or ($common.Count -ge 1 -and ($emrNorm -match $dkeyNorm -or $dkeyNorm -match $emrNorm))) {
      # Found matching product group - now find best strength/dosage match
      $items = $daguByProduct[$dkey]
      $bestScore = -1
      $bestItem = $null

      foreach ($item in $items) {
        $score = 0
        $itemStrength = $item.strength
        $itemDosage = $item.dosage.ToLower()

        # Score by strength match
        # Parse Dagu strength like "(400mg + 80mg)" or "500mg"
        $dagMg = 0
        if ($itemStrength -match '\(?(\d+\.?\d*)\s*mg\s*\+\s*(\d+\.?\d*)\s*mg') {
          $dagMg = [double]::Parse($matches[1]) + [double]::Parse($matches[2])/1000
        } elseif ($itemStrength -match '(\d+\.?\d*)\s*mg') {
          $dagMg = [double]::Parse($matches[1])
        } elseif ($itemStrength -match '(\d+\.?\d*)\s*g(?!ram)') {
          $dagMg = [double]::Parse($matches[1]) * 1000
        } elseif ($itemStrength -match '(\d+\.?\d*)(?:%|microgram|mcg|µg)') {
          $dagMg = -1
        }

        if ($emrStrength -gt 0 -and $dagMg -gt 0) {
          $diff = [Math]::Abs($emrStrength - $dagMg)
          if ($diff -lt 0.1) {
            $score += 100
          } elseif ($diff -lt 10) {
            $score += 50
          } elseif ($diff -lt 50) {
            $score += 10
          }
        } else {
          $score += 1  # no strength to compare
        }

        # Score by dosage form
        $dagForm = "other"
        if ($itemDosage -match '(suspension|syrup|elixir|mixture)') { $dagForm = "suspension" }
        elseif ($itemDosage -match '(tablet|tab)') { $dagForm = "tablet" }
        elseif ($itemDosage -match '(injection|inj|vial|ampoule)') { $dagForm = "injection" }
        elseif ($itemDosage -match '(cream|ointment|lotion|gel)') { $dagForm = "topical" }

        if ($emrForm -eq $dagForm) {
          $score += 50
        }

        # Prefer items with is_used=true (we don't have this in the query now, but unit 'Tablet' vs bulk packaging)
        if ($item.unit -eq 'Tablet' -or $item.unit -eq 'Ampoule' -or $item.unit -eq 'Vial') {
          $score += 20
        }

        if ($score -gt $bestScore) {
          $bestScore = $score
          $bestItem = $item
        }
      }

      if ($bestItem -ne $null -and $bestScore -gt 50) {
        $bestMatch = $bestItem
        $found = $true
      }
      break
    }
  }

  if ($found) {
    $matched += @{
      drug_id = $emr.id
      drug_name = $emr.name
      dagu_product = $bestMatch.product
      dagu_uuid = $bestMatch.uuid
      dagu_strength = $bestMatch.strength
      dagu_dosage = $bestMatch.dosage
      dagu_unit = $bestMatch.unit
      score = $bestScore
    }
  } else {
    $unmatched += $emr
  }
}

Write-Output "`n=== MATCHED DRUGS ==="
Write-Output "Total: $($matched.Count)"
Write-Output ""
$matched | Sort-Object { $_.drug_name }, { $_.drug_id } | ForEach-Object {
  Write-Output "$($_.drug_id): $($_.drug_name) -> $($_.dagu_product) | $($_.dagu_strength) $($_.dagu_dosage) ($($_.dagu_unit)) [$($_.dagu_uuid)]"
}

Write-Output "`n=== UNMATCHED DRUGS ==="
Write-Output "Total: $($unmatched.Count)"
