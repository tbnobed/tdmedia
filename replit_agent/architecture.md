# Architecture Overview

## Overview

Trilogy Digital Media is a secure content management system designed to provide watermarked media streaming for client preview. The application follows a modern full-stack architecture with clearly separated frontend and backend components. It's containerized with Docker for easy deployment and uses PostgreSQL for data persistence.

The system enables administrators to upload, manage, and share various types of media (videos, documents, images, presentations) with clients, who can securely preview the content with watermarks.

## System Architecture

The application follows a client-server architecture:

1. **Frontend**: React-based SPA (Single Page Application) using modern React patterns and UI components from Radix UI/Shadcn UI
2. **Backend**: Node.js Express server providing RESTful API endpoints
3. **Database**: PostgreSQL database for storing user data, media metadata, and content organization
4. **Storage**: File system-based storage for media files, organized by type
5. **Authentication**: Session-based authentication with PostgreSQL session storage

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│               │     │               │     │               │
│   Frontend    │◄────┤    Backend    │◄────┤   Database    │
│   (React)     │     │  (Express.js) │     │  (PostgreSQL) │
│               │     │               │     │               │
└───────────────┘     └───────────────┘     └───────────────┘
                            │
                            ▼
                      ┌───────────────┐
                      │  File Storage │
                      │  (uploads/)   │
                      └───────────────┘
```

## Key Components

### Frontend (Client-side)

- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Framework**: Shadcn UI components built on Radix UI primitives
- **State Management**: React Query for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

The frontend is organized into:
- `components/`: Reusable UI components and layouts
- `pages/`: Page components for different routes
- `hooks/`: Custom React hooks
- `lib/`: Utility functions and API client

### Backend (Server-side)

- **Framework**: Express.js with TypeScript
- **API Style**: RESTful API with JSON
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Authentication**: Passport.js with local strategy
- **Session Management**: express-session with PostgreSQL session store
- **File Upload**: Multer for handling multipart/form-data

The backend code is organized into:
- `server/`: Express server, route definitions, middlewares
- `db/`: Database connection and query utilities
- `shared/`: Shared types and schemas (used by both frontend and backend)

### Data Model

The application's core data model includes:

1. **Users**: Administrator and client user accounts
   - Properties: id, username, email, password (hashed), isAdmin, createdAt

2. **Categories**: Organization of media by categories
   - Properties: id, name, description, createdAt

3. **Media**: The core content managed by the system
   - Properties: id, title, description, type (enum), categoryId, fileUrl, thumbnailUrl, duration, size, createdAt, updatedAt
   - Types: video, document, image, presentation

4. **Contacts**: User inquiries/communication related to media content

### Authentication and Authorization

- Session-based authentication using Passport.js
- Password hashing using Node.js crypto with scrypt
- Role-based authorization (admin vs. client users)
- Session data stored in PostgreSQL for persistence

## Data Flow

### Media Upload Flow

1. Admin authenticates and accesses the admin interface
2. Admin uploads media file through the UI
3. File is processed by the backend:
   - Stored in the appropriate directory based on media type
   - Metadata extracted (size, duration for videos, etc.)
   - Database record created with file metadata and location
4. Media is categorized and made available for client preview

### Media Access Flow

1. Client authenticates to the system
2. Client browses available media by category or search
3. When accessing media:
   - Backend verifies permissions
   - For streaming content, watermarks may be applied
   - Access is logged for analytics
4. Client can request information about specific media via contact form

## External Dependencies

### Frontend Dependencies

- **@radix-ui**: UI primitives for building accessible components
- **@tanstack/react-query**: Data fetching and caching
- **@hookform/resolvers**: Form validation with zod
- **class-variance-authority**: Component variant management
- **clsx/tailwind-merge**: CSS class management utilities

### Backend Dependencies

- **pg/postgres.js**: PostgreSQL client
- **@neondatabase/serverless**: Serverless PostgreSQL support (for dev environment)
- **drizzle-orm**: Type-safe ORM
- **express-session**: Session management
- **multer**: File upload handling
- **connect-pg-simple**: PostgreSQL session store

## Deployment Strategy

The application is designed for Docker-based deployment:

### Docker Containerization

- Multi-container setup via Docker Compose:
  - Application container (Node.js)
  - PostgreSQL database container
- Volume mounts for persistent data:
  - PostgreSQL data
  - Uploaded media files

### Startup Process

1. PostgreSQL container starts first
2. Application container waits for database availability
3. Database schema is initialized if needed
4. Default admin and client users are created if they don't exist
5. Application starts and listens for connections

### Environment Configuration

Configuration is managed through environment variables:
- Database connection details
- Session secret
- Default user credentials
- Application port

The deployment supports both development and production environments with appropriate settings for each.

## Security Considerations

- Passwords are securely hashed using scrypt with unique salts
- Session cookies use httpOnly and secure flags
- Media access is controlled through authentication
- File uploads are validated and restricted by type

## Scalability Considerations

- Stateless application design allows horizontal scaling
- Database connection pooling for efficient resource usage
- Separate volumes for different types of media files
- Docker-based deployment enables container orchestration