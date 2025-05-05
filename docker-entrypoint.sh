#!/bin/sh
set -e

# Enable more verbose debugging
set -x

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
chmod +x docker-setup-users.cjs
node docker-setup-users.cjs

# Examine the build directory
echo "Examining the build directory structure..."
find dist/ -type f | sort

# Generate dynamic config.js
echo "Generating dynamic config.js..."
cat > dist/public/config.js << EOF
// Docker-generated configuration for Trilogy Digital Media
window.TRILOGY_CONFIG = {
  // API URL from environment - empty string because we're serving from the same origin
  apiBaseUrl: '',
  
  // Other configuration options
  version: '1.0.0',
  features: {
    analytics: false,
    darkMode: false
  }
};
EOF

# Verify the config.js file was created
echo "Verifying config.js was created:"
ls -la dist/public/
cat dist/public/config.js

# Start the application
echo "Starting the application..."
exec "$@"