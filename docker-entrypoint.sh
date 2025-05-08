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
until pg_isready -h $PGHOST -p $PGPORT -d $PGDATABASE || [ $RETRIES -eq 0 ]; do
  echo "Waiting for PostgreSQL server ($RETRIES retries left)..."
  RETRIES=$((RETRIES-1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "Error: PostgreSQL server not available"
  exit 1
fi

echo "PostgreSQL server is up and running!"

# Now wait for authentication to be properly set up
echo "Waiting for PostgreSQL authentication to be ready..."
RETRIES=10
AUTH_READY=0
while [ $RETRIES -gt 0 ] && [ $AUTH_READY -eq 0 ]; do
  if PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "SELECT 1" > /dev/null 2>&1; then
    AUTH_READY=1
    echo "PostgreSQL authentication is ready!"
  else
    echo "Waiting for PostgreSQL authentication to be ready ($RETRIES retries left)..."
    RETRIES=$((RETRIES-1))
    sleep 2
  fi
done

if [ $AUTH_READY -eq 0 ]; then
  echo "Warning: Could not authenticate with PostgreSQL, but proceeding anyway as the database might initialize credentials later"
else
  echo "PostgreSQL is fully ready!"
fi

# Initialize the database schema
echo "Initializing database schema..."
chmod +x docker-init-db.cjs

# Create the session table first to avoid it being dropped by Drizzle
echo "Creating session table before schema initialization..."
PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE <<EOF
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
EOF

# Check if the playlists table exists
PLAYLISTS_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playlists')" | grep -q 't'; echo $?)

if [ $PLAYLISTS_TABLE_EXISTS -eq 0 ]; then
  echo "Playlists table already exists."
else
  echo "Playlists table does not exist. Checking for categories table..."
  
  # Check if the categories table exists (older schema)
  CATEGORIES_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')" | grep -q 't'; echo $?)
  
  if [ $CATEGORIES_TABLE_EXISTS -eq 0 ]; then
    echo "Categories table found. Will migrate to playlist-based schema."
  else
    echo "Fresh database installation detected."
  fi
fi

# Check if media_playlists junction table exists
MEDIA_PLAYLISTS_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'media_playlists')" | grep -q 't'; echo $?)

if [ $MEDIA_PLAYLISTS_TABLE_EXISTS -eq 0 ]; then
  echo "Media-playlists junction table already exists."
else
  echo "Media-playlists junction table does not exist. Will be created during schema update."
fi

# Set environment variables to protect session table
export DRIZZLE_SKIP_TABLE_SESSION=true
export PG_SESSION_KEEP_EXISTING=true
export DRIZZLE_ALWAYS_MIGRATE=true

# Run the initialization script
echo "Running database schema migration..."
if node docker-init-db.cjs; then
  echo "Database schema initialized successfully!"
else
  echo "Warning: Database initialization encountered issues, but we'll continue startup."
fi

# Check if categories table still exists after migration
CATEGORIES_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')" | grep -q 't'; echo $?)

if [ $CATEGORIES_TABLE_EXISTS -eq 0 ]; then
  echo "Categories table still exists. For clean database structure, you may wish to remove it after confirming successful migration."
fi

# Verify that playlists table exists after migration
PLAYLISTS_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playlists')" | grep -q 't'; echo $?)

if [ $PLAYLISTS_TABLE_EXISTS -eq 0 ]; then
  echo "Playlists table successfully created/migrated."
else
  echo "ERROR: Playlists table not found after migration. This is a critical error."
  # We continue anyway in case this is just a temporary issue
fi

# Verify that media_playlists junction table exists after migration
MEDIA_PLAYLISTS_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'media_playlists')" | grep -q 't'; echo $?)

if [ $MEDIA_PLAYLISTS_TABLE_EXISTS -eq 0 ]; then
  echo "Media-playlists junction table successfully created."
else
  echo "ERROR: Media-playlists junction table not found after migration. This is a critical error."
  # We continue anyway in case this is just a temporary issue
fi

# Setup default users
echo "Setting up default users..."
chmod +x docker-setup-users.cjs
node docker-setup-users.cjs

# Set up session table if needed (but don't drop it if it exists!)
echo "Setting up session table for authentication..."
# First check if the session table already exists to prevent dropping it
PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session')" | grep -q 't'
SESSION_TABLE_EXISTS=$?

if [ $SESSION_TABLE_EXISTS -eq 0 ]; then
  echo "Session table already exists, skipping creation."
else
  echo "Creating session table..."
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE <<EOF
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
EOF
  echo "Session table created successfully!"
fi

# Make sure express-session won't try to drop the table by setting session_table_noexists
# This is a safeguard for connect-pg-simple's behavior
export PG_SESSION_KEEP_EXISTING=true
echo "Session table setup complete!"

# Ensure upload directories exist with proper permissions
echo "Setting up upload directories..."
{
  mkdir -p /app/uploads/videos
  mkdir -p /app/uploads/images
  mkdir -p /app/uploads/documents
  mkdir -p /app/uploads/presentations
  mkdir -p /app/uploads/thumbnails
  
  # Try to set permissions, but don't fail if it's a read-only filesystem
  chmod -R 755 /app/uploads 2>/dev/null || echo "Warning: Could not set permissions for /app/uploads (read-only filesystem)"
  
  # If we couldn't write to /app/uploads, try /tmp as a fallback
  if [ ! -w "/app/uploads" ]; then
    echo "Warning: /app/uploads is not writable. Using /tmp as fallback."
    # Create symbolic links from non-writable locations to writable ones
    ln -sf /tmp/uploads/videos /app/uploads/videos 2>/dev/null || echo "Warning: Could not create symlink for videos"
    ln -sf /tmp/uploads/images /app/uploads/images 2>/dev/null || echo "Warning: Could not create symlink for images"
    ln -sf /tmp/uploads/documents /app/uploads/documents 2>/dev/null || echo "Warning: Could not create symlink for documents"
    ln -sf /tmp/uploads/presentations /app/uploads/presentations 2>/dev/null || echo "Warning: Could not create symlink for presentations"
    ln -sf /tmp/uploads/thumbnails /app/uploads/thumbnails 2>/dev/null || echo "Warning: Could not create symlink for thumbnails"
  fi
} || echo "Warning: Issues with upload directory setup (container restriction)"

# Set file size limit for the container
echo "Setting file size limits for uploads..."
# Using try/catch pattern for each ulimit command to handle restricted containers gracefully
ulimit -f 2000000 > /dev/null 2>&1 || echo "Warning: Unable to set file size limit (normal in restricted containers)"
ulimit -n 8192 > /dev/null 2>&1 || echo "Warning: Unable to set open file limit (normal in restricted containers)"
ulimit -c unlimited > /dev/null 2>&1 || echo "Warning: Unable to set core dump limit (normal in restricted containers)"
ulimit -m unlimited > /dev/null 2>&1 || echo "Warning: Unable to set memory limit (normal in restricted containers)"
echo "System limits configured where allowed by container security"

# Make sure temporary directory exists with proper permissions
{
  mkdir -p /tmp/uploads
  mkdir -p /tmp/uploads/videos
  mkdir -p /tmp/uploads/images
  mkdir -p /tmp/uploads/documents
  mkdir -p /tmp/uploads/presentations
  mkdir -p /tmp/uploads/thumbnails
  chmod 777 /tmp/uploads 2>/dev/null || echo "Warning: Could not set permissions for /tmp/uploads (unusual restriction)"
} || echo "Warning: Issues with temporary directory setup (container restriction)"

# Set environment variable to inform the application about filesystem restrictions
if [ ! -w "/app/uploads" ]; then
  export RESTRICTED_FILESYSTEM="true"
  echo "Setting RESTRICTED_FILESYSTEM=true due to filesystem limitations"
fi

# Configure Node.js for large file uploads
export NODE_MAX_HTTP_HEADER_SIZE=81920 # Increase HTTP header size to 80KB
export UV_THREADPOOL_SIZE=32 # Increase libuv thread pool for better I/O performance

# Configure network settings
echo "Configuring network settings for large file handling..."
# We won't try to modify system files directly as they might be read-only in container environments
# Instead we'll use sysctl command where available, and gracefully handle if it's not possible

# Check if sysctl command is available
if command -v sysctl > /dev/null 2>&1; then
  # Try to set the values with sysctl, but ignore errors
  sysctl -w net.core.somaxconn=65535 > /dev/null 2>&1 || echo "Unable to set somaxconn (normal in restricted containers)"
  sysctl -w net.ipv4.tcp_max_syn_backlog=65535 > /dev/null 2>&1 || echo "Unable to set tcp_max_syn_backlog (normal in restricted containers)"
  sysctl -w net.ipv4.tcp_fin_timeout=10 > /dev/null 2>&1 || echo "Unable to set tcp_fin_timeout (normal in restricted containers)"
  sysctl -w net.ipv4.tcp_keepalive_time=300 > /dev/null 2>&1 || echo "Unable to set tcp_keepalive_time (normal in restricted containers)"
  echo "Network settings configured where allowed by container security"
else
  echo "sysctl command not available - skipping network configuration (normal in restricted containers)"
fi

# Start the application
echo "Starting the application..."
exec "$@"