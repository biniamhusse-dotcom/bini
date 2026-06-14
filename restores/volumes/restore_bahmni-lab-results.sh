#!/bin/bash

# Usage:
#   bash restore_bahmni-lab-results.sh                  # restore latest
#   bash restore_bahmni-lab-results.sh 20260605_125336  # restore specific date

VOL_NAME="bahmni-standard_bahmni-lab-results"
BACKUP_DIR="$(dirname "$0")/../../backups/bahmni"
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
SCRIPT_DIR="$(cd "$(dirname "$FILE")" && pwd)"
docker run --rm \
  -v "$VOL_NAME:/data" \
  -v "$SCRIPT_DIR:/backup" \
  busybox sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$FILE") -C /data"
echo "Restore complete. Exit: $?"
