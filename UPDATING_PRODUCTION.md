# Updating the Production Deployment

This document provides instructions for updating the production deployment of Trilogy Digital Media with the latest changes.

## Recent Changes

1. **Playlist System Implementation**
   - Replaced Categories with Playlists for more flexible media organization
   - Added many-to-many relationship between media and playlists
   - Automatic migration from old category system to new playlist system
   - Improved media filtering by playlist

2. **Thumbnail Management System**
   - Enhanced video player to display thumbnails as posters before video playback starts
   - Automatic cleanup of old thumbnail files when new ones are uploaded
   - Added path validation to ensure only thumbnails for specific media are deleted
   - Improved file existence checks before deletion to prevent errors
   - Auto-thumbnail generation for videos now cleans up existing thumbnails first

3. **Client Management Enhancements**
   - New client creation flow with direct media assignment
   - Welcome email functionality using SendGrid
   - Improved client listing and management interface

4. **Admin Dashboard Navigation**
   - Improved tab navigation with hash-based URL support
   - Better integration between client management and media access assignment
   - LocalStorage for persistent client selection across tabs

5. **Email Integration**
   - SendGrid integration for welcome emails to new clients
   - HTML email templates for professional onboarding
   - Configurable application domain for email URLs via APP_DOMAIN environment variable

6. **Bug Fixes**
   - Fixed media playlist relationship issues
   - Corrected inconsistencies in column naming (snake_case vs. camelCase)
   - Fixed Edit Media form to properly load and update playlist selections
   - Fixed media streaming with thumbnail support

## Update Steps

### 1. Backup Current Deployment

Before updating, create a backup of your current deployment:

```bash
# Backup your database (if using external PostgreSQL)
pg_dump -U your_db_user -d your_db_name > trilogy_backup_$(date +%Y%m%d).sql

# Or if using Docker volumes, create a backup of your volumes
docker run --rm -v trilogy_db_data:/dbdata -v $(pwd):/backup alpine tar czf /backup/trilogy_db_backup_$(date +%Y%m%d).tar.gz /dbdata
```

### 2. Pull Latest Code Changes

```bash
# Navigate to your project directory
cd /path/to/trilogy-digital-media

# Pull the latest changes
git pull origin main
```

### 3. Update Environment Variables

Add the new environment variables to your `.env` file:

```bash
# Email configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=alerts@obedtv.com

# Application domain for welcome emails and links
APP_DOMAIN=tdev.obdtv.com
```

> **Important:** For SendGrid, the `SENDGRID_FROM_EMAIL` must be a domain you've verified with SendGrid. Using an unverified sender email will cause emails to fail to send.

### 4. Rebuild and Restart Containers

```bash
# Rebuild the containers with the latest code
docker compose build

# Restart the application
docker compose down
docker compose up -d
```

### 5. Verify the Update

1. Check the application logs to ensure everything is starting correctly:
   ```bash
   docker compose logs -f
   ```

2. Verify the database migration was successful by checking for these messages in the logs:
   - "Configuration: Retry count=5, Retry delay=3s, Force direct creation=true" - confirms initialization configuration
   - "Direct SQL table creation executed as first step" - confirms first-phase table creation
   - "SUCCESS: Direct SQL creation verified - playlists table exists!" - confirms table verification
   - "All required tables verified successfully!" - confirms tables are ready for use
   - "Database schema initialization completed successfully" - confirms the entire process completed

3. Log in to the admin panel and verify that:
   - The "Playlists" tab appears in the admin dashboard
   - All existing media appears under appropriate playlists
   - You can add/remove media to/from playlists
   - You can create new playlists
   - Media filtering by playlist works correctly

4. Verify media management functionality:
   - Create a new media item and assign it to multiple playlists
   - Edit an existing media item and modify its playlist assignments
   - Verify that playlist assignments persist correctly after edits

5. Verify client functionality:
   - The "Clients" tab is accessible
   - You can create new clients
   - Media assignment works correctly with the new playlist system
   - Tab navigation is functioning properly

6. Test the email functionality by creating a new client with the "Send Welcome Email" option enabled. Verify that the welcome email contains the correct application domain URL as specified in your APP_DOMAIN environment variable.

## Rollback Procedure

If something goes wrong with the playlist migration, you have two options for rollback:

### Option 1: Complete Rollback (Recommended)

This option restores from a backup taken before the update and reverts to the previous code version:

```bash
# Stop the current containers
docker compose down

# Restore database from your backup
# If using an external database:
psql -U your_db_user -d your_db_name < trilogy_backup_YYYYMMDD.sql

# Or if using Docker volumes:
docker run --rm -v trilogy_db_data:/dbdata -v $(pwd):/backup alpine sh -c "rm -rf /dbdata/* && tar xzf /backup/trilogy_db_backup_YYYYMMDD.tar.gz -C /"

# Return to the previous code version
git checkout previous_commit_hash

# Rebuild and restart with the old code
docker compose build
docker compose up -d
```

### Option 2: Partial Rollback (If Categories Table Still Exists)

If you set `PRESERVE_CATEGORIES_TABLE=true` during the update and the categories table still exists, you can attempt this partial rollback that preserves any new media added after the update:

```bash
# Stop the current containers
docker compose down

# Create a simple SQL script to restore category relationships
cat > restore-categories.sql << 'EOF'
-- Recreate category_id column in media table if it doesn't exist
ALTER TABLE media ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id);

-- Set category_id based on media_playlists data
UPDATE media m
SET category_id = (
  SELECT mp.playlist_id 
  FROM media_playlists mp 
  WHERE mp.media_id = m.id 
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM media_playlists mp WHERE mp.media_id = m.id
);

-- Set default category for any media without a playlist
UPDATE media 
SET category_id = (SELECT id FROM categories WHERE name = 'Uncategorized' LIMIT 1)
WHERE category_id IS NULL;
EOF

# Apply the restoration script
cat restore-categories.sql | docker exec -i postgres psql -U ${POSTGRES_USER:-trilogy_user} -d ${POSTGRES_DB:-trilogy_db}

# Return to the previous code version
git checkout previous_commit_hash

# Rebuild and restart with old code
docker compose build
docker compose up -d
```

**Important:** The partial rollback option is more complex and may not work in all scenarios. It should only be attempted if a complete rollback from backup is not possible.

## Important Notes

- **Database Schema Migration**: This update includes a significant schema change, migrating from categories to playlists. The migration will be performed automatically during container startup.
  - The migration preserves all existing media categorization by moving category associations to the new playlist system
  - A backup of your database is *highly recommended* before performing this update
  - The migration creates a new `playlists` table and `media_playlists` junction table
  - Existing media-category relationships will be preserved during the migration
  - Enhanced table verification with automatic recovery handles any migration timing issues
  - Multiple failsafe mechanisms ensure tables are created even if Drizzle migration encounters issues

- **Environment Variables**: New environment variables have been added to control the migration and database initialization process:
  ```
  # Playlist Migration Controls
  ENABLE_PLAYLIST_MIGRATION=true      # Enable migration from categories to playlists
  PRESERVE_CATEGORIES_TABLE=false     # Whether to keep categories table after migration
  CREATE_DEFAULT_PLAYLIST=true        # Create default 'Uncategorized' playlist
  DRIZZLE_ALWAYS_MIGRATE=true         # Always run migrations on startup
  
  # Database Initialization Configuration (New)
  DB_INIT_RETRY_COUNT=5               # Number of retry attempts for table verification
  DB_INIT_RETRY_DELAY=3               # Delay in seconds between retry attempts
  FORCE_DIRECT_TABLE_CREATION=true    # Use direct SQL for table creation (recommended for reliability)
  ```

- **Enhanced Docker Deployment Process**: This update includes significant improvements to the Docker deployment process:
  - Multi-layer approach to database initialization for maximum reliability
  - Configurable retry mechanism for table verification with detailed logging
  - Direct SQL table creation option that can be enabled/disabled via environment variables
  - Automatic recovery systems to handle edge cases during initialization
  - Better handling of session table persistence to prevent login disruptions
  - Improved error handling and reporting during the initialization process

- The session table might be recreated during the update. This will invalidate any existing user sessions, requiring users to log in again.
- Make sure your firewall allows outbound connections to SendGrid's SMTP servers if you plan to use the email functionality.
- Set the APP_DOMAIN environment variable to your actual application domain (e.g., 'tdev.obdtv.com') to ensure welcome emails contain the correct login URLs.

## Playlist System Benefits

The new playlist system offers several improvements over the previous categories system:

1. **Media in Multiple Playlists**: Unlike the previous category system where media could only belong to a single category, the new playlist system allows each media item to be included in multiple playlists.

2. **More Flexible Organization**: Playlists enable more logical grouping of media, similar to how music or video streaming services organize content.

3. **Improved Discovery**: Clients can now find the same content through different playlists, making media discovery more intuitive.

4. **Enhanced Media Management**: Administrators can organize content more effectively by topic, client, project, or any other criteria without duplicating media files.

5. **Performance Improvements**: The new schema includes proper database indexes to improve query performance, especially for larger media libraries.

6. **Future-Ready**: The playlist architecture provides a foundation for future features such as automated playlists, personalized recommendations, and more sophisticated media organization.