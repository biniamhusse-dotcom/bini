#!/bin/bash

# Usage: bash restore_postgres.sh

IMAGE="postgres:9.6"
BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
FILE="$BACKUP_DIR/images/postgres_9.6.tar.gz"

echo "=== Image Restore: $IMAGE ==="

if [ ! -f "$FILE" ]; then
  echo "ERROR: File not found: $FILE"; exit 1
fi

echo "Loading image from $FILE..."
docker load -i "$FILE"
echo "Image restored. Exit: $?"
