# WHO Trauma Form Concept Import Script
# This script imports the WHO Trauma Form concepts into OpenMRS

$OpenMRSUrl = "http://localhost:8186/openmrs/ws/rest/v1"
$Username = "admin"
$Password = "Admin123"

# Function to create a concept
function Create-Concept {
    param(
        [string]$Name,
        [string]$Description,
        [string]$ClassName,
        [string]$DataType,
        [string]$ShortName
    )
    
    $concept = @{
        name = $Name
        description = $Description
        conceptClass = @{
            name = $ClassName
        }
        datatype = @{
            name = $DataType
        }
        names = @(
            @{
                name = $Name
                locale = "en"
                localePreferred = $true
                conceptNameType = "FULLY_SPECIFIED"
            },
            @{
                name = $ShortName
                locale = "en"
                localePreferred = $false
                conceptNameType = "SHORT"
            }
        )
    }
    
    $json = $concept | ConvertTo-Json -Depth 10
    $headers = @{
        "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$OpenMRSUrl/concept" -Method Post -Headers $headers -Body $json
        Write-Host "Created concept: $Name" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "Error creating concept $Name : $_" -ForegroundColor Red
        return $null
    }
}

# Function to create a concept set
function Create-ConceptSet {
    param(
        [string]$Name,
        [string]$Description,
        [array]$MemberNames
    )
    
    $members = @()
    foreach ($memberName in $MemberNames) {
        $searchResult = Invoke-RestMethod -Uri "$OpenMRSUrl/concept?q=$memberName&v=full" -Headers @{
            "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
        }
        
        if ($searchResult.results.Count -gt 0) {
            $concept = $searchResult.results | Where-Object { $_.name -eq $memberName } | Select-Object -First 1
            if ($concept) {
                $members += @{
                    uuid = $concept.uuid
                }
            }
        }
    }
    
    $conceptSet = @{
        name = $Name
        description = $Description
        conceptClass = @{
            name = "Misc"
        }
        datatype = @{
            name = "N/A"
        }
        names = @(
            @{
                name = $Name
                locale = "en"
                localePreferred = $true
                conceptNameType = "FULLY_SPECIFIED"
            }
        )
        setMembers = $members
    }
    
    $json = $conceptSet | ConvertTo-Json -Depth 10
    $headers = @{
        "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${Username}:${Password}"))
        "Content-Type" = "application/json"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$OpenMRSUrl/concept" -Method Post -Headers $headers -Body $json
        Write-Host "Created concept set: $Name" -ForegroundColor Green
        return $response
    } catch {
        Write-Host "Error creating concept set $Name : $_" -ForegroundColor Red
        return $null
    }
}

Write-Host "Starting WHO Trauma Form concept import..." -ForegroundColor Cyan

# Import generic concepts (answer options)
Write-Host "`nImporting generic concepts (answer options)..." -ForegroundColor Yellow
$genericConcepts = Import-Csv "C:\Users\COMPUTER\Documents\emr\config\openmrs\templates\WHO_Trauma_generic_concepts.csv"

foreach ($concept in $genericConcepts) {
    if ($concept.name) {
        Create-Concept -Name $concept.name -Description $concept.description -ClassName $concept.class -DataType $concept.datatype -ShortName $concept.shortname
    }
}

# Import observation concepts
Write-Host "`nImporting observation concepts..." -ForegroundColor Yellow
$observationConcepts = Import-Csv "C:\Users\COMPUTER\Documents\emr\config\openmrs\templates\WHO_Trauma_concepts.csv"

foreach ($concept in $observationConcepts) {
    if ($concept.name) {
        Create-Concept -Name $concept.name -Description $concept.description -ClassName $concept.class -DataType $concept.datatype -ShortName $concept.shortname
    }
}

Write-Host "`nConcept import completed!" -ForegroundColor Green
Write-Host "Please restart the Bahmni services to apply changes." -ForegroundColor Cyan
