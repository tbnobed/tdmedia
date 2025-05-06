# Updating the Production Deployment

This document provides instructions for updating the production deployment of Trilogy Digital Media with the latest changes.

## Recent Changes

1. **Client Management Enhancements**
   - New client creation flow with direct media assignment
   - Welcome email functionality using SendGrid
   - Improved client listing and management interface

2. **Admin Dashboard Navigation**
   - Improved tab navigation with hash-based URL support
   - Better integration between client management and media access assignment
   - LocalStorage for persistent client selection across tabs

3. **Email Integration**
   - SendGrid integration for welcome emails to new clients
   - HTML email templates for professional onboarding
   - Configurable application domain for email URLs via APP_DOMAIN environment variable

4. **Bug Fixes**
   - Fixed navigation between dashboard tabs
   - Improved media access verification
   - Enhanced security checks for media assignment

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

2. Log in to the admin panel and verify that:
   - The "Clients" tab is accessible
   - You can create new clients
   - Media assignment works correctly
   - Tab navigation is functioning properly

3. Test the email functionality by creating a new client with the "Send Welcome Email" option enabled. Verify that the welcome email contains the correct application domain URL as specified in your APP_DOMAIN environment variable.

## Rollback Procedure

If something goes wrong, you can roll back to the previous version:

```bash
# Stop the current containers
docker compose down

# Restore from your backup
# If using an external database:
psql -U your_db_user -d your_db_name < trilogy_backup_YYYYMMDD.sql

# Or if using Docker volumes:
docker run --rm -v trilogy_db_data:/dbdata -v $(pwd):/backup alpine sh -c "rm -rf /dbdata/* && tar xzf /backup/trilogy_db_backup_YYYYMMDD.tar.gz -C /"

# Return to the previous code version
git checkout previous_commit_hash

# Rebuild and restart
docker compose build
docker compose up -d
```

## Important Notes

- The session table might be recreated during the update. This will invalidate any existing user sessions, requiring users to log in again.
- Make sure your firewall allows outbound connections to SendGrid's SMTP servers if you plan to use the email functionality.
- Set the APP_DOMAIN environment variable to your actual application domain (e.g., 'tdev.obdtv.com') to ensure welcome emails contain the correct login URLs.
- No database schema migrations are required for this update as all changes are compatible with the existing schema.