#!/bin/bash

# Usage: bash restore_selamsew_openelis.sh

IMAGE="selamsew_openelis:1.0.0-uog-1.0.5"
BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
FILE="$BACKUP_DIR/images/selamsew_openelis_1.0.0-uog-1.0.5.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
