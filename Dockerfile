FROM node:20-alpine

WORKDIR /app

# Install dependencies for building and running
RUN apk update && apk add --no-cache python3 make g++ postgresql-client

# Install additional tools for media processing and large file support
RUN apk add --no-cache ffmpeg

# Configure system for large file uploads
RUN echo "fs.file-max = 65535" >> /etc/sysctl.conf && \
    echo "net.core.somaxconn = 65535" >> /etc/sysctl.conf && \
    echo "vm.max_map_count = 262144" >> /etc/sysctl.conf

# Install dependencies first (leverage Docker cache)
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Create directory structure for media files with proper subdirectories
# and ensure the upload directories have proper permissions
RUN mkdir -p /app/uploads/videos && \
    mkdir -p /app/uploads/images && \
    mkdir -p /app/uploads/documents && \
    mkdir -p /app/uploads/presentations && \
    mkdir -p /app/uploads/thumbnails && \
    chmod -R 755 /app/uploads

# Copy config.js to the dist directory to ensure it's available in production
RUN cp -f client/public/config.js dist/public/ || true

# Copy Docker setup scripts
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY docker-init-db.cjs /app/docker-init-db.cjs
COPY docker-setup-users.cjs /app/docker-setup-users.cjs

# Make scripts executable
RUN chmod +x /app/docker-entrypoint.sh /app/docker-init-db.cjs /app/docker-setup-users.cjs

# Set Node.js memory limits higher for large file operations
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Set larger timeout for Node.js operations
ENV NODE_TIMEOUT=1800000

# Expose the application port
EXPOSE 5000

# Set entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command
CMD ["npm", "run", "start"]