#!/bin/bash

# Usage: bash restore_bahmni_odoo-connect.sh

IMAGE="bahmni_odoo-connect:1.0.0"
BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
FILE="$BACKUP_DIR/images/bahmni_odoo-connect_1.0.0.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
