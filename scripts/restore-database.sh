#!/bin/bash

# Database restoration script for production
# Usage: ./restore-database.sh <backup_file.sql.gz>

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Example: $0 /home/backups/database/trilogy_db_backup_20241205_120000.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="tdmedia-postgres-1"
DB_USER="trilogy_user"
DB_NAME="trilogy_db"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file '$BACKUP_FILE' not found"
    exit 1
fi

echo "WARNING: This will REPLACE the current database with the backup!"
echo "Backup file: $BACKUP_FILE"
echo "Database: $DB_NAME"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Restoration cancelled"
    exit 0
fi

echo "Starting database restoration..."

# Stop the application to prevent connections
echo "Stopping application container..."
docker-compose stop app

# Drop existing database and recreate
echo "Recreating database..."
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
echo "Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

# Restart the application
echo "Starting application container..."
docker-compose start app

echo "Database restoration completed successfully"