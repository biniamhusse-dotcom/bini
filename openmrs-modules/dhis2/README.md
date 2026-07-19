# DHIS2 Connector Module for OpenMRS

This directory contains the .omod files required for DHIS2 integration with OpenMRS.

## Required Modules

| Module | Version | Purpose |
|--------|---------|---------|
| dhisconnector | 1.5.6 | DHIS2 Connector (main module) |
| reporting | 0.9.4 | Reporting Module (dependency) |
| reportingrest | 1.5.1 | Reporting Rest Module (dependency) |
| webservices.rest | 2.26 | REST Web Services (dependency) |
| serialization.xstream | 0.2.10 | Serialization (dependency) |
| htmlwidgets | 1.7.2 | HTML Widgets (dependency) |
| calculation | 1.1 | Calculation (dependency) |

## How to Install

### Option 1: Download using the setup script

Run the download script from the project root:

`ash
# Ubuntu/Git Bash
bash openmrs-modules/download_dhis2_modules.sh

# Windows PowerShell
 powershell -ExecutionPolicy Bypass -File openmrs-modules\download_dhis2_modules.ps1
`

### Option 2: Manual download

Download each .omod file from the OpenMRS Module Repository:

1. Go to https://addons.openmrs.org
2. Search for each module
3. Download the .omod file
4. Place it in this directory

### Option 3: Upload via OpenMRS UI

1. Start OpenMRS without the DHIS2 modules
2. Go to Administration > Manage Modules
3. Click "Add Module"
4. Browse to each .omod file and upload

## After Installation

1. Restart OpenMRS
2. Go to Administration > Configure DHIS Server
3. Enter your DHIS2 instance details
4. Create Period Indicator Report mappings
5. Map OpenMRS Locations to DHIS2 Organisation Units

## Troubleshooting

- If modules fail to load, check OpenMRS logs: docker logs bahmni-standard-openmrs-1
- Ensure all dependency modules are installed before the DHIS2 connector
- The Reporting Rest Module must be version 1.5.1 (specific build)
