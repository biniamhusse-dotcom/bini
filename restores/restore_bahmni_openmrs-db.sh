#!/bin/bash

# Usage: bash restore_bahmni_openmrs-db.sh

IMAGE="bahmni_openmrs-db:1.0.0-standard"
BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
FILE="$BACKUP_DIR/images/bahmni_openmrs-db_1.0.0-standard.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
