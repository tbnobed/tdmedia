# Trilogy Digital Media

A secure content management system with watermarked media streaming for client preview.

## Docker Deployment

This project is designed to be deployed using Docker Compose, making it easy to set up and run in any Linux environment.

### Prerequisites

- Docker (20.10.0+)
- Docker Compose (2.0.0+)

### Quick Start

1. Clone the repository
2. Copy `.env.example` to `.env` and modify any values if needed
   ```bash
   cp .env.example .env
   ```
3. Build and start the application
   ```bash
   docker compose build
   docker compose up -d
   ```
4. Access the application at http://localhost:5000

### Environment Variables

The following environment variables can be set in the `.env` file:

#### Database Configuration
- `POSTGRES_USER`: Database username (default: trilogy_user)
- `POSTGRES_PASSWORD`: Database password (default: postgres)
- `POSTGRES_DB`: Database name (default: trilogy_db)
- `POSTGRES_PORT`: Database port (default: 5432)
- `DATABASE_URL`: Full database connection string (constructed automatically)

#### Application Configuration
- `NODE_ENV`: Environment mode (default: production)
- `PORT`: Application port (default: 5000)
- `SESSION_SECRET`: Secret for session encryption (default: trilogy_session_secret)

#### Email Configuration
- `SENDGRID_API_KEY`: SendGrid API key for sending emails (required for client onboarding email functionality)

#### Default Users
- `ADMIN_EMAIL`: Admin email (default: admin@example.com)
- `ADMIN_PASSWORD`: Admin password (default: adminpassword)
- `ADMIN_USERNAME`: Admin username (default: admin)
- `CLIENT_EMAIL`: Client email (default: client@example.com)
- `CLIENT_PASSWORD`: Client password (default: demopassword)
- `CLIENT_USERNAME`: Client username (default: client)

### Data Persistence

The application uses Docker volumes for data persistence:

- `trilogy_db_data`: PostgreSQL database data
- `trilogy_media_data`: Uploaded media files

### Default Credentials

Two default users are created automatically:

1. **Admin User**
   - Email: admin@example.com (or value from `ADMIN_EMAIL`)
   - Password: adminpassword (or value from `ADMIN_PASSWORD`)
   - Has full access to administration features

2. **Client User**
   - Email: client@example.com (or value from `CLIENT_EMAIL`)
   - Password: demopassword (or value from `CLIENT_PASSWORD`)
   - Has restricted access to view watermarked media

### Health Checks

The application provides a health check endpoint at `/api/healthcheck` that can be used to monitor the application status.

### Docker Commands

- Build the containers:
  ```bash
  docker compose build
  ```

- Start the application:
  ```bash
  docker compose up -d
  ```

- View logs:
  ```bash
  docker compose logs -f
  ```

- Stop the application:
  ```bash
  docker compose down
  ```

- Remove volumes and completely reset (caution - data will be lost):
  ```bash
  docker compose down -v
  ```

## Application Features

- Secure content management system
- User authentication and role-based access control
- Media library with categories and filtering
- Watermarked media streaming for preview
- Contact form for client inquiries
- Admin panel for content management
- Client user management with automated onboarding
- Welcome emails for new clients via SendGrid integration
- Granular media access control for individual clients
- Advanced navigation between admin dashboard tabs