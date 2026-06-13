#!/bin/bash

# Usage: bash restore_bahmni_appointments.sh

IMAGE="bahmni_appointments:1.1.1"
BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
FILE="$BACKUP_DIR/images/bahmni_appointments_1.1.1.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
