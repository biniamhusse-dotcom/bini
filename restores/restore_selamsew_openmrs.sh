#!/bin/bash

# Usage: bash restore_selamsew_openmrs.sh

IMAGE="selamsew_openmrs:1.1.1-uog-1.0.2"
BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
FILE="$BACKUP_DIR/images/selamsew_openmrs_1.1.1-uog-1.0.2.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
