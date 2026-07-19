# DHIS2 Module Download Script for OpenMRS
# Run this script to download all required .omod files for DHIS2 integration

$dhisDir = "C:\Users\COMPUTER\Documents\emr\openmrs-modules\dhis2"

Write-Host "=== DHIS2 Module Download Script ===" -ForegroundColor Cyan
Write-Host "This script downloads all required OpenMRS modules for DHIS2 integration." -ForegroundColor Gray
Write-Host ""

# Create directory if it doesn't exist
if (-not (Test-Path $dhisDir)) {
    New-Item -ItemType Directory -Path $dhisDir -Force | Out-Null
}

# Module definitions with multiple download sources
$modules = @(
    @{
        Name = "dhisconnector-1.5.6"
        Description = "DHIS2 Connector Module (main)"
        Urls = @(
            "https://github.com/jembi/openmrs-module-dhisconnector/releases/download/1.5.6/dhisconnector-1.5.6.omod",
            "https://github.com/openmrs/openmrs-module-dhisconnector/releases/download/1.5.6/dhisconnector-1.5.6.omod"
        )
    },
    @{
        Name = "reporting-0.9.4"
        Description = "Reporting Module (dependency)"
        Urls = @(
            "https://github.com/openmrs/openmrs-module-reporting/releases/download/0.9.4/reporting-0.9.4.omod"
        )
    },
    @{
        Name = "reportingrest-1.5.1"
        Description = "Reporting Rest Module (dependency - specific build)"
        Urls = @(
            "https://github.com/psbrandt/openmrs-module-reportingrest/releases/download/1.5.1/reportingrest-1.5.1.omod",
            "https://github.com/openmrs/openmrs-module-reportingrest/releases/download/1.5.1/reportingrest-1.5.1.omod"
        )
    },
    @{
        Name = "webservices.rest-2.26"
        Description = "REST Web Services Module (dependency)"
        Urls = @(
            "https://github.com/openmrs/openmrs-module-webservices.rest/releases/download/2.26/webservices.rest-2.26.omod"
        )
    },
    @{
        Name = "serialization.xstream-0.2.10"
        Description = "Serialization Module (dependency)"
        Urls = @(
            "https://github.com/openmrs/openmrs-module-serialization.xstream/releases/download/0.2.10/serialization.xstream-0.2.10.omod"
        )
    },
    @{
        Name = "htmlwidgets-1.7.2"
        Description = "HTML Widgets Module (dependency)"
        Urls = @(
            "https://github.com/openmrs/openmrs-module-htmlwidgets/releases/download/1.7.2/htmlwidgets-1.7.2.omod"
        )
    },
    @{
        Name = "calculation-1.1"
        Description = "Calculation Module (dependency)"
        Urls = @(
            "https://github.com/openmrs/openmrs-module-calculation/releases/download/1.1/calculation-1.1.omod"
        )
    }
)

$successCount = 0
$failCount = 0

foreach ($mod in $modules) {
    $fileName = "$($mod.Name).omod"
    $filePath = Join-Path $dhisDir $fileName
    
    Write-Host "Downloading: $($mod.Description)" -ForegroundColor Yellow
    
    # Skip if already exists and is valid
    if (Test-Path $filePath) {
        $fileSize = (Get-Item $filePath).Length
        if ($fileSize -gt 1000) {
            Write-Host "  Already exists: $fileName ($fileSize bytes)" -ForegroundColor Green
            $successCount++
            continue
        } else {
            Remove-Item $filePath -Force
        }
    }
    
    $downloaded = $false
    foreach ($url in $mod.Urls) {
        Write-Host "  Trying: $url" -ForegroundColor Gray
        try {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $webClient = New-Object System.Net.WebClient
            $webClient.DownloadFile($url, $filePath)
            $fileSize = (Get-Item $filePath).Length
            if ($fileSize -gt 1000) {
                Write-Host "  SUCCESS: Downloaded $fileName ($fileSize bytes)" -ForegroundColor Green
                $downloaded = $true
                $successCount++
                break
            } else {
                Remove-Item $filePath -Force
                Write-Host "  File too small, trying next URL..." -ForegroundColor DarkYellow
            }
        } catch {
            Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor DarkGray
        }
    }
    
    if (-not $downloaded) {
        Write-Host "  FAILED: Could not download $fileName" -ForegroundColor Red
        $failCount++
    }
    Write-Host ""
}

Write-Host "=== Download Summary ===" -ForegroundColor Cyan
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

if ($failCount -gt 0) {
    Write-Host "Some modules could not be downloaded automatically." -ForegroundColor Yellow
    Write-Host "Please download them manually from https://addons.openmrs.org" -ForegroundColor Yellow
    Write-Host "and place the .omod files in: $dhisDir" -ForegroundColor Yellow
} else {
    Write-Host "All modules downloaded successfully!" -ForegroundColor Green
    Write-Host "You can now restart OpenMRS to load the DHIS2 modules." -ForegroundColor Green
}

Write-Host ""
Write-Host "Files in $dhisDir" -ForegroundColor Cyan
Get-ChildItem $dhisDir -Filter "*.omod" | Format-Table Name, @{Name="Size(KB)"; Expression={[math]::Round($_.Length/1024, 1)}} -AutoSize
