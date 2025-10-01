# Trilogy Digital Media

## Overview

Trilogy Digital Media is a secure content management system designed for watermarked media streaming and client preview. The application allows administrators to upload, categorize, and manage media content (videos, documents, images, presentations) while providing controlled access to client users. The system features playlist-based organization, content classification (films/TV shows), language indicators, watermarking capabilities, and email notifications for client onboarding.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Technology Stack

**Frontend:**
- React with TypeScript
- Vite for build tooling
- TanStack Query for server state management
- Radix UI components with Tailwind CSS
- shadcn/ui component library

**Backend:**
- Express.js server (Node.js)
- PostgreSQL database
- Drizzle ORM for database operations
- Passport.js for authentication with local strategy
- Express-session for session management

**Infrastructure:**
- Docker Compose for containerized deployment
- Multi-container setup (app + PostgreSQL)
- Volume persistence for uploads and database

### Database Architecture

**Core Schema Design:**
- Drizzle ORM with PostgreSQL dialect
- Snake_case column naming convention in database
- CamelCase in application layer (mapped by Drizzle)

**Key Tables:**
- `users`: Admin and client user accounts with password hashing
- `media`: Content items with type classification, metadata, file references
- `playlists`: Organizational groups for media (migrated from categories)
- `media_playlists`: Many-to-many junction table for media-playlist relationships
- `media_access`: Controls which clients can access specific media items
- `contacts`: Contact form submissions linked to media items
- `session`: Express session storage for authentication

**Migration Strategy:**
- Automatic schema updates via Drizzle Kit push on container startup
- Migration from categories to playlists system handled during deployment
- Session table created before schema migrations to prevent data loss
- Verification steps after migrations to ensure table existence

### Authentication & Authorization

**Session-Based Authentication:**
- Express-session with PostgreSQL store
- Passport.js local strategy for username/password authentication
- Scrypt-based password hashing with salt
- Role-based access control (admin vs. client users)

**Access Control:**
- Admin users: Full system access, media management, client management
- Client users: Limited to assigned media via media_access table
- Signed URLs for secure media streaming with signature validation

### Media Management

**File Upload & Storage:**
- Multer for multipart/form-data handling
- Large file support (up to 10GB configured)
- Organized directory structure: `/uploads/{videos|documents|images|presentations|thumbnails}`
- Docker volume persistence for uploaded files

**Media Processing:**
- FFmpeg integration for video duration extraction and thumbnail generation
- Automatic thumbnail cleanup when new thumbnails are uploaded
- File metadata extraction (size, duration, type)

**Content Classification:**
- Media type enum: video, document, image, presentation
- Content type: Film or TV Show with conditional metadata
- Language indicators: EN, ES, EN/ES, OTHER
- Playlist associations for flexible organization

**Watermarking:**
- Streaming video watermarking capability
- Controlled access through signed streaming URLs

### Client Management & Onboarding

**Client Creation Workflow:**
- Admin creates client accounts with direct media assignment
- Automatic password generation
- Welcome email delivery via SendGrid integration

**Email System:**
- SendGrid API integration for transactional emails
- HTML email templates with application branding
- Configurable sender email and application domain

### API Architecture

**RESTful Endpoints:**
- `/api/auth/*`: Login, logout, user session management
- `/api/media/*`: CRUD operations for media, thumbnail uploads
- `/api/playlists/*`: Playlist management
- `/api/users/*`: User and client management
- `/api/media-access/*`: Client-media access assignment
- `/api/stream/*`: Secure media streaming with signature validation
- `/api/upload`: File upload endpoint with type-specific handling

**Request Handling:**
- Streaming uploads (no buffering) for large files
- Progress tracking support
- Error handling with structured responses
- Request logging for debugging

### Frontend Architecture

**Component Structure:**
- Modular page-based routing
- Shared UI components from shadcn/ui
- Form handling with React Hook Form and Zod validation
- Optimistic UI updates with TanStack Query

**State Management:**
- Server state via TanStack Query with caching
- LocalStorage for client selection persistence
- Hash-based URL state for tab navigation

**Media Display:**
- Grid and list view options
- Pagination support
- Search and filter capabilities
- Language badges and content type indicators
- Responsive thumbnail display with fallbacks

### Deployment Configuration

**Docker Setup:**
- Multi-stage build process
- Health checks for both app and database containers
- Automatic database initialization on first run
- Default admin and client user seeding
- Environment-based configuration

**Container Startup Sequence:**
1. PostgreSQL health verification
2. Session table creation (protected from drops)
3. Schema migration via Drizzle
4. Playlist table verification and retry logic
5. Default user creation
6. Application server start

**Environment Variables:**
- Database credentials and connection string
- Session secret for encryption
- SendGrid API credentials
- Admin default credentials
- Application domain for email links

### Large File Handling

**System Optimizations:**
- Nginx proxy configuration for large uploads
- Request buffering disabled
- Extended timeouts (up to 1 hour for very large files)
- No client body size limits
- Direct streaming to backend

**Container Considerations:**
- Read-only filesystem compatibility
- System limit configuration attempts with graceful fallbacks
- Volume-based storage for persistence

### Production Considerations

**Security:**
- Environment-based secrets management
- Signed URLs for media access
- Session-based authentication
- SQL injection prevention via ORM
- File path validation for deletions

**Reliability:**
- Health checks for monitoring
- Connection pooling for database
- Automatic retries for critical operations
- Graceful error handling and logging

**Scalability:**
- Stateless application design (session in database)
- Volume-based media storage
- Configurable file size limits
- Pagination for large datasets