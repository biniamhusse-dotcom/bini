#!/bin/bash

# Usage:
#   bash restore_odooappdata.sh                  # restore latest
#   bash restore_odooappdata.sh 20260605_125336  # restore specific date

VOL_NAME="bahmni-standard_odooappdata"
BACKUP_DIR="$(dirname "$0")/../backups/bahmni"
DATE_ARG="$1"

echo "=== Volume Restore: $VOL_NAME ==="

if [ -z "$DATE_ARG" ]; then
  FILE=$(ls -t "$BACKUP_DIR/volumes/${VOL_NAME}_"*.tar.gz 2>/dev/null | head -1)
else
  FILE="$BACKUP_DIR/volumes/${VOL_NAME}_${DATE_ARG}.tar.gz"
fi

if [ ! -f "$FILE" ]; then
  echo "ERROR: No backup found for $VOL_NAME"; exit 1
fi

echo "File: $FILE"
VOL_BASE="/var/lib/docker/volumes/$VOL_NAME/_data"
mkdir -p "$VOL_BASE"
rm -rf "${VOL_BASE:?}"/*
tar -xzf "$FILE" -C "$VOL_BASE"
echo "Restore complete. Exit: $?"

echo "Fixing Odoo filestore permissions..."
docker run --rm -v "$VOL_NAME:/data" busybox chown -R 101:101 /data
