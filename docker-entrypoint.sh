#!/bin/sh
set -e

echo "Waiting for PostgreSQL to become available..."

# Wait for PostgreSQL to be available
RETRIES=30
until pg_isready -h postgres -U ${POSTGRES_USER:-trilogy_user} -d ${POSTGRES_DB:-trilogy_db} || [ $RETRIES -eq 0 ]; do
  echo "Waiting for PostgreSQL ($RETRIES retries left)..."
  RETRIES=$((RETRIES-1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "Error: PostgreSQL not available"
  exit 1
fi

echo "PostgreSQL is ready!"

# Initialize the database schema
echo "Initializing database schema..."
npm run db:push

echo "Database schema initialized successfully!"

# Setup default users
echo "Setting up default users..."
chmod +x docker-setup-users.js
node docker-setup-users.js

# Start the application
echo "Starting the application..."
exec "$@"