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

# Configure retry settings from environment variables
DB_INIT_RETRY_COUNT=${DB_INIT_RETRY_COUNT:-5}
DB_INIT_RETRY_DELAY=${DB_INIT_RETRY_DELAY:-3}
echo "Using database initialization settings: MAX_RETRIES=$DB_INIT_RETRY_COUNT, RETRY_SLEEP=$DB_INIT_RETRY_DELAY seconds"

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
PLAYLISTS_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playlists')")
PLAYLISTS_TABLE_EXISTS=$(echo "$PLAYLISTS_TABLE_EXISTS" | xargs)

if [ "$PLAYLISTS_TABLE_EXISTS" = "t" ]; then
  echo "Playlists table already exists."
else
  echo "Playlists table does not exist. Checking for categories table..."
  
  # Check if the categories table exists (older schema)
  CATEGORIES_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')")
  CATEGORIES_TABLE_EXISTS=$(echo "$CATEGORIES_TABLE_EXISTS" | xargs)
  
  if [ "$CATEGORIES_TABLE_EXISTS" = "t" ]; then
    echo "Categories table found. Will migrate to playlist-based schema."
  else
    echo "Fresh database installation detected."
  fi
fi

# Check if media_playlists junction table exists
MEDIA_PLAYLISTS_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'media_playlists')")
MEDIA_PLAYLISTS_TABLE_EXISTS=$(echo "$MEDIA_PLAYLISTS_TABLE_EXISTS" | xargs)

if [ "$MEDIA_PLAYLISTS_TABLE_EXISTS" = "t" ]; then
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

# Apply content classification migration
echo "Applying content classification migration..."
if [ -f scripts/content_classification_migration.sql ]; then
  echo "Content classification migration SQL file found, executing..."
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f scripts/content_classification_migration.sql
  
  if [ $? -eq 0 ]; then
    echo "Content classification migration completed successfully!"
  else
    echo "Warning: Content classification migration encountered issues, but we'll continue startup."
  fi
else
  echo "Content classification migration SQL file not found, skipping."
fi

# Apply language field migration
echo "Applying language field migration..."
if [ -f scripts/language_field_migration.sql ]; then
  echo "Language field migration SQL file found, executing..."
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f scripts/language_field_migration.sql
  
  if [ $? -eq 0 ]; then
    echo "Language field migration completed successfully!"
    
    # Verify language column exists in media table
    LANGUAGE_COLUMN_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'language')")
    LANGUAGE_COLUMN_EXISTS=$(echo "$LANGUAGE_COLUMN_EXISTS" | xargs)
    
    if [ "$LANGUAGE_COLUMN_EXISTS" = "t" ]; then
      echo "✓ Language column verified in media table."
    else
      echo "⚠️ WARNING: Language column not found in media table after migration. This may indicate a migration issue."
    fi
  else
    echo "Warning: Language field migration encountered issues, but we'll continue startup."
  fi
else
  echo "Language field migration SQL file not found, skipping."
fi

# Give PostgreSQL a moment to process any changes
echo "Waiting for database to settle after migration (3 seconds)..."
sleep 3

# Function to verify table existence with retry
verify_table_exists() {
  local table_name=$1
  local max_attempts=${DB_INIT_RETRY_COUNT:-3}
  local sleep_time=${DB_INIT_RETRY_DELAY:-2}
  local attempt=1
  local exists="f"
  
  echo "Verifying ${table_name} table exists (max attempts: $max_attempts, retry delay: ${sleep_time}s)..."
  
  while [ $attempt -le $max_attempts ] && [ "$exists" != "t" ]; do
    exists=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table_name}')")
    exists=$(echo "$exists" | xargs)
    
    if [ "$exists" = "t" ]; then
      echo "${table_name} table exists. Verification successful."
      return 0
    else
      echo "Attempt $attempt of $max_attempts: ${table_name} table not found, retrying in ${sleep_time} seconds..."
      sleep $sleep_time
      attempt=$((attempt+1))
    fi
  done
  
  if [ "$exists" != "t" ]; then
    echo "ERROR: ${table_name} table not found after $max_attempts attempts."
    return 1
  fi
}

# Check for categories table
CATEGORIES_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories')")
CATEGORIES_TABLE_EXISTS=$(echo "$CATEGORIES_TABLE_EXISTS" | xargs)

if [ "$CATEGORIES_TABLE_EXISTS" = "t" ]; then
  echo "Categories table still exists. For clean database structure, you may wish to remove it after confirming successful migration."
fi

# Verify playlists and media_playlists tables with retry logic
verify_table_exists "playlists"
PLAYLISTS_VERIFIED=$?

verify_table_exists "media_playlists" 
MEDIA_PLAYLISTS_VERIFIED=$?

if [ $PLAYLISTS_VERIFIED -eq 0 ] && [ $MEDIA_PLAYLISTS_VERIFIED -eq 0 ]; then
  echo "Playlist migration verification complete: All required tables exist."
else
  echo "WARNING: Some playlist tables could not be verified. Attempting manual creation..."
  
  # Create the tables directly as a fallback
  echo "⚠️ WARNING: Direct table creation fallback being executed..."
  # First try to do a basic check for any lock issues
  echo "Checking for connection or lock issues..."
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c 'SELECT 1 as connection_test' || { 
    echo "ERROR: Cannot execute basic SQL command. Database might be unavailable."
    exit 1
  }
  
  # Try to terminate any conflicting connections
  echo "Attempting to terminate any conflicting sessions..."
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE <<EOL
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE pid <> pg_backend_pid() 
  AND datname = '$PGDATABASE'
  AND state = 'idle in transaction';
EOL
  
  echo "Creating missing tables directly with SQL (strict mode)..."
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE <<EOF
  -- Create playlists table if it doesn't exist
  CREATE TABLE IF NOT EXISTS playlists (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );
  
  -- Create media_playlists table if it doesn't exist
  CREATE TABLE IF NOT EXISTS media_playlists (
    id SERIAL PRIMARY KEY,
    media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  );
  
  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_media_playlists_media_id ON media_playlists(media_id);
  CREATE INDEX IF NOT EXISTS idx_media_playlists_playlist_id ON media_playlists(playlist_id);
  
  -- Create default 'Uncategorized' playlist if it doesn't exist
  INSERT INTO playlists (name, description)
  SELECT 'Uncategorized', 'Default category for uncategorized media'
  WHERE NOT EXISTS (SELECT 1 FROM playlists WHERE name = 'Uncategorized');
  
  -- Migrate data from categories table if needed
  DO \$\$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') 
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'category_id') THEN
      -- Import categories into playlists if they don't already exist
      INSERT INTO playlists (id, name, description, created_at)
      SELECT c.id, c.name, c.description, c.created_at
      FROM categories c
      WHERE NOT EXISTS (SELECT 1 FROM playlists p WHERE p.name = c.name);
      
      -- Set sequence to correct value
      PERFORM setval('playlists_id_seq', (SELECT COALESCE(MAX(id), 0) FROM playlists) + 1, false);
      
      -- Migrate media-category relationships to media-playlist relationships
      INSERT INTO media_playlists (media_id, playlist_id, created_at)
      SELECT m.id, m.category_id, NOW()
      FROM media m
      WHERE m.category_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM media_playlists mp 
        WHERE mp.media_id = m.id AND mp.playlist_id = m.category_id
      );
    END IF;
  END \$\$;
EOF
  
  # Re-verify after manual creation
  echo "Verifying tables after manual creation..."
  PLAYLISTS_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playlists')")
  PLAYLISTS_EXISTS=$(echo "$PLAYLISTS_EXISTS" | xargs)
  
  MEDIA_PLAYLISTS_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'media_playlists')")
  MEDIA_PLAYLISTS_EXISTS=$(echo "$MEDIA_PLAYLISTS_EXISTS" | xargs)
  
  if [ "$PLAYLISTS_EXISTS" = "t" ] && [ "$MEDIA_PLAYLISTS_EXISTS" = "t" ]; then
    echo "SUCCESS: All required tables were created successfully through direct SQL."
  else
    echo "ERROR: Failed to create required tables even with direct SQL. This may indicate database permission issues."
    # Continue anyway since we've done everything we can
  fi
fi

# Setup default users
echo "Setting up default users..."
chmod +x docker-setup-users.cjs
node docker-setup-users.cjs

# Set up session table if needed (but don't drop it if it exists!)
echo "Setting up session table for authentication..."
# First check if the session table already exists to prevent dropping it
SESSION_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session')")
SESSION_TABLE_EXISTS=$(echo "$SESSION_TABLE_EXISTS" | xargs)

if [ "$SESSION_TABLE_EXISTS" = "t" ]; then
  echo "Session table already exists, verifying session table structure..."
  
  # Check if session table has expire column index
  SESSION_INDEX_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_session_expire')")
  SESSION_INDEX_EXISTS=$(echo "$SESSION_INDEX_EXISTS" | xargs)
  
  if [ "$SESSION_INDEX_EXISTS" = "f" ]; then
    echo "Session table exists but index is missing. Creating index..."
    PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "CREATE INDEX IF NOT EXISTS \"IDX_session_expire\" ON \"session\" (\"expire\");"
  fi
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

# Verify the session table exists after our creation attempt
SESSION_TABLE_EXISTS=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session')")
SESSION_TABLE_EXISTS=$(echo "$SESSION_TABLE_EXISTS" | xargs)

if [ "$SESSION_TABLE_EXISTS" = "f" ]; then
  echo "⚠️ WARNING: Session table doesn't exist even after creation attempt."
  echo "Trying one more direct approach..."
  
  # One more attempt with a simpler command
  PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c '
  CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL,
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    PRIMARY KEY ("sid")
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  '
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
    # Create directories in /tmp first
    mkdir -p /tmp/uploads/videos
    mkdir -p /tmp/uploads/images
    mkdir -p /tmp/uploads/documents
    mkdir -p /tmp/uploads/presentations
    mkdir -p /tmp/uploads/thumbnails
    
    # Create symbolic links from non-writable locations to writable ones
    ln -sf /tmp/uploads/videos /app/uploads/videos 2>/dev/null || echo "Warning: Could not create symlink for videos"
    ln -sf /tmp/uploads/images /app/uploads/images 2>/dev/null || echo "Warning: Could not create symlink for images"
    ln -sf /tmp/uploads/documents /app/uploads/documents 2>/dev/null || echo "Warning: Could not create symlink for documents"
    ln -sf /tmp/uploads/presentations /app/uploads/presentations 2>/dev/null || echo "Warning: Could not create symlink for presentations"
    ln -sf /tmp/uploads/thumbnails /app/uploads/thumbnails 2>/dev/null || echo "Warning: Could not create symlink for thumbnails"
    
    # Set permissions on /tmp/uploads
    chmod -R 755 /tmp/uploads 2>/dev/null || echo "Warning: Could not set permissions for /tmp/uploads"
  fi
  
  # Create .gitkeep files to ensure directories are tracked in git
  for dir in /app/uploads/videos /app/uploads/images /app/uploads/documents /app/uploads/presentations /app/uploads/thumbnails; do
    touch $dir/.gitkeep 2>/dev/null || echo "Warning: Could not create .gitkeep in $dir"
  done
  
  echo "Upload directories setup complete"
} || echo "Warning: Issues with upload directory setup (container restriction)"

# Set file size limit for the container
echo "Setting file size limits for uploads..."
# Using try/catch pattern for each ulimit command to handle restricted containers gracefully
ulimit -f 10000000 > /dev/null 2>&1 || echo "Warning: Unable to set file size limit (normal in restricted containers)"
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