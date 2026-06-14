#!/bin/bash

# Usage: bash restore_selamsew_global_property.sh

IMAGE="selamsew_global_property:uog-1.0.2"
BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
FILE="$BACKUP_DIR/images/selamsew_global_property_uog-1.0.2.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
