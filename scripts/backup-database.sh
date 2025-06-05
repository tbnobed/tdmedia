#!/bin/bash

# Database backup script for production
# Run this script to create timestamped database backups

set -e

# Configuration
BACKUP_DIR="/home/backups/database"
CONTAINER_NAME="tdmedia-postgres-1"
DB_USER="trilogy_user"
DB_NAME="trilogy_db"
RETENTION_DAYS=30

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/trilogy_db_backup_$TIMESTAMP.sql.gz"

echo "Starting database backup..."
echo "Backup file: $BACKUP_FILE"

# Create compressed backup
docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

# Verify backup was created
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo "Backup completed successfully: $BACKUP_FILE"
    echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "Error: Backup failed or file is empty"
    exit 1
fi

# Clean up old backups (older than retention period)
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "trilogy_db_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

echo "Backup process completed"