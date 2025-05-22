#!/bin/bash
# Database migration verification script
# This script checks that all required tables and columns exist in the database

set -e

echo "Verifying database schema migration..."

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

# Function to display status with color
print_status() {
  local label=$1
  local status=$2
  
  if [ "$status" = "t" ]; then
    echo -e "✅ $label: \033[32mFound\033[0m"
  else
    echo -e "❌ $label: \033[31mMissing\033[0m"
  fi
}

echo "============================================"
echo "DATABASE SCHEMA VERIFICATION"
echo "============================================"

# Check core tables
echo "Checking core tables..."
users_exists=$(check_table_exists "users")
media_exists=$(check_table_exists "media")
playlists_exists=$(check_table_exists "playlists")
media_playlists_exists=$(check_table_exists "media_playlists")
media_access_exists=$(check_table_exists "media_access")
session_exists=$(check_table_exists "session")
contacts_exists=$(check_table_exists "contacts")

print_status "users table" "$users_exists"
print_status "media table" "$media_exists"
print_status "playlists table" "$playlists_exists"
print_status "media_playlists table" "$media_playlists_exists"
print_status "media_access table" "$media_access_exists"
print_status "session table" "$session_exists"
print_status "contacts table" "$contacts_exists"

echo "============================================"
echo "CHECKING MEDIA TABLE COLUMNS"
echo "============================================"

# Check media table columns (content classification)
if [ "$media_exists" = "t" ]; then
  echo "Checking content classification fields..."
  content_type_exists=$(check_column_exists "media" "content_type")
  year_exists=$(check_column_exists "media" "year")
  season_number_exists=$(check_column_exists "media" "season_number")
  total_episodes_exists=$(check_column_exists "media" "total_episodes")
  total_seasons_exists=$(check_column_exists "media" "total_seasons")
  language_exists=$(check_column_exists "media" "language")
  
  print_status "content_type column" "$content_type_exists"
  print_status "year column" "$year_exists"
  print_status "season_number column" "$season_number_exists"
  print_status "total_episodes column" "$total_episodes_exists"
  print_status "total_seasons column" "$total_seasons_exists"
  print_status "language column" "$language_exists"
  
  if [ "$language_exists" = "f" ]; then
    echo "⚠️ WARNING: Language column is missing. Consider running the language field migration."
  fi
  
  if [ "$content_type_exists" = "f" ]; then
    echo "⚠️ WARNING: Content type column is missing. Consider running the content classification migration."
  fi
else
  echo "❌ Cannot check media columns because media table doesn't exist."
fi

echo "============================================"
echo "VERIFICATION SUMMARY"
echo "============================================"

# Count missing tables
missing_tables=0
for table in "$users_exists" "$media_exists" "$playlists_exists" "$media_playlists_exists" "$media_access_exists" "$session_exists"; do
  if [ "$table" = "f" ]; then
    missing_tables=$((missing_tables+1))
  fi
done

# Count missing columns (if media table exists)
missing_columns=0
if [ "$media_exists" = "t" ]; then
  for column in "$content_type_exists" "$language_exists"; do
    if [ "$column" = "f" ]; then
      missing_columns=$((missing_columns+1))
    fi
  done
fi

if [ $missing_tables -eq 0 ] && [ $missing_columns -eq 0 ]; then
  echo "✅ SUCCESS: All required tables and columns are present."
  echo "Database schema verification completed successfully."
  exit 0
else
  echo "⚠️ WARNING: Some tables or columns are missing:"
  echo "  - Missing tables: $missing_tables"
  echo "  - Missing columns: $missing_columns"
  echo "Please check the migration logs for errors."
  exit 1
fi