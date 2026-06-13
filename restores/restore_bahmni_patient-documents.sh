#!/bin/bash

# Usage: bash restore_bahmni_patient-documents.sh

IMAGE="bahmni_patient-documents:1.1.1"
BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
FILE="$BACKUP_DIR/images/bahmni_patient-documents_1.1.1.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
