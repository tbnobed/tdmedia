#!/bin/bash
# Schema migration application script
# This script applies all necessary schema migrations in the correct order

set -e

echo "Starting comprehensive schema migration application..."

# Set PostgreSQL connection variables from environment
PGHOST=${PGHOST:-postgres}
PGUSER=${PGUSER:-trilogy_user}
PGPASSWORD=${PGPASSWORD:-postgres}
PGDATABASE=${PGDATABASE:-trilogy_db}
PGPORT=${PGPORT:-5432}

# Function to check if a table exists
check_table_exists() {
  local table_name=$1
  local result=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table_name}')")
  result=$(echo "$result" | xargs)
  echo "$result"
}

# Function to check if a column exists in a table
check_column_exists() {
  local table_name=$1
  local column_name=$2
  local result=$(PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -c "SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name = '${table_name}' AND column_name = '${column_name}')")
  result=$(echo "$result" | xargs)
  echo "$result"
}

# Function to execute a SQL file with error handling
execute_sql_file() {
  local file_path=$1
  local description=$2
  
  echo "Applying $description..."
  if [ -f "$file_path" ]; then
    if PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -f "$file_path"; then
      echo "✅ $description applied successfully"
      return 0
    else
      echo "⚠️ Warning: Failed to apply $description, but continuing"
      return 1
    fi
  else
    echo "❌ Error: $file_path not found"
    return 1
  fi
}

echo "============================================"
echo "DATABASE SCHEMA MIGRATION"
echo "============================================"

# First, ensure the media table exists before trying to add columns
media_exists=$(check_table_exists "media")
if [ "$media_exists" != "t" ]; then
  echo "❌ Error: Media table not found. Cannot proceed with column migrations."
  exit 1
fi

# Apply content classification migration if needed
content_type_exists=$(check_column_exists "media" "content_type")
if [ "$content_type_exists" != "t" ]; then
  execute_sql_file "scripts/content_classification_migration.sql" "content classification migration"
  
  # Verify the migration was successful
  content_type_exists=$(check_column_exists "media" "content_type")
  if [ "$content_type_exists" = "t" ]; then
    echo "✅ Content classification migration verified"
  else
    echo "⚠️ Warning: Content classification migration could not be verified"
    
    # Try direct column creation as fallback
    echo "Attempting direct content_type column creation..."
    PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "
    ALTER TABLE media ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'other';
    ALTER TABLE media ADD COLUMN IF NOT EXISTS year INTEGER;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS season_number INTEGER;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS total_episodes INTEGER;
    ALTER TABLE media ADD COLUMN IF NOT EXISTS total_seasons INTEGER;
    "
  fi
fi

# Apply language field migration if needed
language_exists=$(check_column_exists "media" "language")
if [ "$language_exists" != "t" ]; then
  execute_sql_file "scripts/language_field_migration.sql" "language field migration"
  
  # Verify the migration was successful
  language_exists=$(check_column_exists "media" "language")
  if [ "$language_exists" = "t" ]; then
    echo "✅ Language field migration verified"
  else
    echo "⚠️ Warning: Language field migration could not be verified"
    
    # Try direct column creation as fallback
    echo "Attempting direct language column creation..."
    PGPASSWORD=$PGPASSWORD psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -c "
    ALTER TABLE media ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'EN' NOT NULL;
    "
  fi
fi

echo "============================================"
echo "MIGRATION SUMMARY"
echo "============================================"

# Final verification
content_type_exists=$(check_column_exists "media" "content_type")
language_exists=$(check_column_exists "media" "language")

if [ "$content_type_exists" = "t" ] && [ "$language_exists" = "t" ]; then
  echo "✅ SUCCESS: All schema migrations applied successfully."
  exit 0
else
  echo "⚠️ WARNING: Some migrations may not have been applied completely:"
  if [ "$content_type_exists" != "t" ]; then
    echo "  - Content type fields are missing"
  fi
  if [ "$language_exists" != "t" ]; then
    echo "  - Language field is missing"
  fi
  exit 1
fi