#!/bin/bash

# Volume-level backup script
# This creates a tar backup of the entire PostgreSQL data volume

set -e

BACKUP_DIR="/home/backups/volumes"
VOLUME_NAME="tdmedia_db_data"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/db_volume_backup_$TIMESTAMP.tar.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting volume backup..."
echo "Volume: $VOLUME_NAME"
echo "Backup file: $BACKUP_FILE"

# Stop postgres container to ensure consistency
docker-compose stop postgres

# Create volume backup
docker run --rm \
  -v "$VOLUME_NAME":/data \
  -v "$BACKUP_DIR":/backup \
  alpine:latest \
  tar czf "/backup/db_volume_backup_$TIMESTAMP.tar.gz" -C /data .

# Start postgres container
docker-compose start postgres

echo "Volume backup completed: $BACKUP_FILE"
echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"