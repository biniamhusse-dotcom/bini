#!/bin/bash

# Usage: bash restore_selamsew_lab-result-sync.sh

IMAGE="selamsew_lab-result-sync:1.0.2-remove-validation"
BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
FILE="$BACKUP_DIR/images/selamsew_lab-result-sync_1.0.2-remove-validation.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
