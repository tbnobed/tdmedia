# Production Deployment Checklist

Use this checklist to verify that your production deployment of Trilogy Digital Media is properly configured and working as expected.

## Pre-Deployment Verification

- [ ] All code changes have been tested in development environment
- [ ] Database schema updates have been tested
- [ ] Docker Compose configuration has been updated with new environment variables
- [ ] SendGrid API key has been obtained for email functionality
- [ ] SendGrid sender email has been verified in the SendGrid dashboard
- [ ] Content classification migration has been properly included in deployment

## Environment Configuration

- [ ] `.env` file contains all required variables including `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`
- [ ] Database credentials are secure in production
- [ ] `SESSION_SECRET` is set to a strong random value
- [ ] Admin credentials have been changed from defaults
- [ ] Docker Compose file uses appropriate volume paths for production

## Security Verification

- [ ] All uploaded media files are stored in Docker volumes, not on ephemeral container storage
- [ ] Session table is properly created in the database
- [ ] Media access permissions are working correctly
- [ ] Client accounts can only access specifically assigned media
- [ ] Watermarking functionality is working on all media types

## Functionality Testing

- [ ] Admin can log in and access all dashboard tabs
- [ ] Media upload and management is working
- [ ] Category creation and management is working
- [ ] Client user creation is working
- [ ] Welcome emails are being sent properly (check SendGrid logs)
- [ ] Media assignment to clients is working correctly
- [ ] Navigation between dashboard tabs is functioning properly
- [ ] Client users can log in and see only their assigned media
- [ ] Contact form submissions are being recorded
- [ ] Content classification fields (Film/TV Show) are functioning properly
- [ ] Content type information is displayed correctly to clients

## Performance and Reliability

- [ ] Docker healthchecks are passing for all containers
- [ ] Database connections are properly closed after use
- [ ] Large file uploads are working (test with files > 100MB)
- [ ] The application restarts properly after server reboot
- [ ] Load balancing and proxy configurations are properly set (if applicable)

## Backup and Recovery

- [ ] Database backup procedure is documented and tested
- [ ] Media files backup procedure is documented and tested
- [ ] Rollback procedure is documented and tested
- [ ] Regular backup schedule is established

## Documentation

- [ ] README is updated with latest features and configuration options
- [ ] Update procedure is documented for future updates
- [ ] Admin and client user guides are available
- [ ] Contact information for support is provided to users

## After Deployment

- [ ] Monitor application logs for errors
- [ ] Check system resources (CPU, memory, disk usage)
- [ ] Verify all users can log in
- [ ] Test sending welcome emails to new clients
- [ ] Verify media streaming with watermarks is working

## Troubleshooting Common Issues

### Database Connection Issues
- Verify DATABASE_URL is correct in `.env` file
- Check that PostgreSQL container is running
- Ensure database ports are properly mapped

### Email Sending Problems
- Verify SENDGRID_API_KEY is correctly set
- Verify SENDGRID_FROM_EMAIL is set to a SendGrid-verified sender address
- Check SendGrid dashboard for sending limits or blocks
- Look for error logs related to email sending
- Ensure the verification process for your sender domain is complete in SendGrid

### Media Upload Issues
- Check disk space on upload volumes
- Verify file permissions in upload directories
- Increase timeout values if large uploads are timing out

### Session/Authentication Problems
- Verify session table exists in database
- Check SESSION_SECRET is consistent across deployments
- Clear browser cache and cookies if session issues persist