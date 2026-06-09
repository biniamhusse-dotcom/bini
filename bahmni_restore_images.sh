#!/bin/bash

BACKUP_DIR="/opt/backups/bahmni/images"
LOG="/opt/backups/bahmni/restore_images_$(date +%Y%m%d_%H%M%S).log"

echo "=== Docker Image Restore Started: $(date) ===" | tee -a "$LOG"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "ERROR: $BACKUP_DIR not found" | tee -a "$LOG"; exit 1
fi

for FILE in "$BACKUP_DIR"/*.tar.gz; do
  echo "Loading: $FILE" | tee -a "$LOG"
  docker load < "$FILE"
  echo "✓ exit: $?" | tee -a "$LOG"
done

echo "=== Image Restore Complete: $(date) ===" | tee -a "$LOG"
docker images | tee -a "$LOG"