#!/bin/sh
set -e

echo "Waiting for PostgreSQL to become available..."

# Set production environment
export NODE_ENV=production

# Configure PostgreSQL connection variables if not already set
export PGHOST=${PGHOST:-postgres}
export PGUSER=${PGUSER:-trilogy_user}
export PGPASSWORD=${PGPASSWORD:-postgres}
export PGDATABASE=${PGDATABASE:-trilogy_db}
export PGPORT=${PGPORT:-5432}

# Build DATABASE_URL from environment variables if not already set
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"
  echo "Setting DATABASE_URL to $DATABASE_URL"
fi

# Also set SESSION_SECRET if not provided
if [ -z "$SESSION_SECRET" ]; then
  export SESSION_SECRET="trilogy-digital-media-secure-session"
  echo "Warning: Using default SESSION_SECRET. Consider setting it via environment variable."
fi

# Wait for PostgreSQL to be available
RETRIES=30
until pg_isready -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE || [ $RETRIES -eq 0 ]; do
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
chmod +x docker-setup-users.cjs
node docker-setup-users.cjs

# Start the application
echo "Starting the application..."
exec "$@"