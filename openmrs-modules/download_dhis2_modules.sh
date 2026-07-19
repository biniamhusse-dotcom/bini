#!/bin/bash
# DHIS2 Module Download Script for OpenMRS
# Run this script to download all required .omod files for DHIS2 integration

DHIS_DIR="$(dirname "$0")/dhis2"

echo "=== DHIS2 Module Download Script ==="
echo "This script downloads all required OpenMRS modules for DHIS2 integration."
echo ""

# Create directory if it doesn't exist
mkdir -p "$DHIS_DIR"

# Module definitions
declare -A MODULES=(
    ["dhisconnector-1.5.6"]="DHIS2 Connector Module (main)|https://github.com/jembi/openmrs-module-dhisconnector/releases/download/1.5.6/dhisconnector-1.5.6.omod"
    ["reporting-0.9.4"]="Reporting Module (dependency)|https://github.com/openmrs/openmrs-module-reporting/releases/download/0.9.4/reporting-0.9.4.omod"
    ["reportingrest-1.5.1"]="Reporting Rest Module (dependency)|https://github.com/psbrandt/openmrs-module-reportingrest/releases/download/1.5.1/reportingrest-1.5.1.omod"
    ["webservices.rest-2.26"]="REST Web Services Module (dependency)|https://github.com/openmrs/openmrs-module-webservices.rest/releases/download/2.26/webservices.rest-2.26.omod"
    ["serialization.xstream-0.2.10"]="Serialization Module (dependency)|https://github.com/openmrs/openmrs-module-serialization.xstream/releases/download/0.2.10/serialization.xstream-0.2.10.omod"
    ["htmlwidgets-1.7.2"]="HTML Widgets Module (dependency)|https://github.com/openmrs/openmrs-module-htmlwidgets/releases/download/1.7.2/htmlwidgets-1.7.2.omod"
    ["calculation-1.1"]="Calculation Module (dependency)|https://github.com/openmrs/openmrs-module-calculation/releases/download/1.1/calculation-1.1.omod"
)

SUCCESS_COUNT=0
FAIL_COUNT=0

for MODULE_NAME in "${!MODULES[@]}"; do
    IFS='|' read -r DESCRIPTION URL <<< "${MODULES[$MODULE_NAME]}"
    FILE_NAME="${MODULE_NAME}.omod"
    FILE_PATH="${DHIS_DIR}/${FILE_NAME}"

    echo "Downloading: ${DESCRIPTION}"

    # Skip if already exists and is valid
    if [ -f "$FILE_PATH" ]; then
        FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null)
        if [ "$FILE_SIZE" -gt 1000 ]; then
            echo "  Already exists: ${FILE_NAME} (${FILE_SIZE} bytes)"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
            continue
        else
            rm -f "$FILE_PATH"
        fi
    fi

    # Download
    if curl -L -f -o "$FILE_PATH" "$URL" 2>/dev/null; then
        FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null)
        if [ "$FILE_SIZE" -gt 1000 ]; then
            echo "  SUCCESS: Downloaded ${FILE_NAME} (${FILE_SIZE} bytes)"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
            rm -f "$FILE_PATH"
            echo "  FAILED: File too small"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    else
        echo "  FAILED: Could not download from ${URL}"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
    echo ""
done

echo "=== Download Summary ==="
echo "Successful: ${SUCCESS_COUNT}"
echo "Failed: ${FAIL_COUNT}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "Some modules could not be downloaded automatically."
    echo "Please download them manually from https://addons.openmrs.org"
    echo "and place the .omod files in: ${DHIS_DIR}"
else
    echo "All modules downloaded successfully!"
    echo "You can now restart OpenMRS to load the DHIS2 modules."
fi

echo ""
echo "Files in ${DHIS_DIR}:"
ls -lh "${DHIS_DIR}"/*.omod 2>/dev/null || echo "No .omod files found"
