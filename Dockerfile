FROM node:20-alpine

WORKDIR /app

# Install dependencies for building, running, and troubleshooting
RUN apk add --no-cache python3 make g++ postgresql-client curl wget netcat-openbsd procps bash

# Install dependencies first (leverage Docker cache)
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Create directory for media files
RUN mkdir -p /app/media

# Create public assets directory
RUN mkdir -p dist/public/assets

# Copy static files to the dist directory
RUN cp -f client/public/docker-config.js dist/public/config.js || echo "No docker config found, skipping"

# Set up public assets directory with improved structure
RUN mkdir -p dist/public/assets
RUN mkdir -p dist/client/assets

# Organize all assets with a robust approach
RUN echo "Setting up assets for Docker deployment..."

# Copy all client public files (including config)
RUN cp -r client/public/* dist/public/ || echo "No client public files found"

# Copy from possible build directories, capture any output for debugging
RUN echo "Copying from possible build directories..." && \
    (find dist/client -type f -name "*.js" -o -name "*.css" | xargs -r -I{} cp {} dist/public/assets/ 2>/dev/null || echo "No build files found in dist/client") && \
    (find dist/assets -type f -name "*.js" -o -name "*.css" | xargs -r -I{} cp {} dist/public/assets/ 2>/dev/null || echo "No build files found in dist/assets")

# Copy our custom fallback assets
COPY public/assets/index.js dist/public/assets/index.js
COPY public/assets/index.css dist/public/assets/index.css
COPY public/assets/manifest.json dist/public/assets/manifest.json

# Generate comprehensive asset manifest based on actual files
RUN echo "Generating asset manifest..." && \
    echo '{' > dist/public/assets/manifest.json && \
    echo '  "assets": [' >> dist/public/assets/manifest.json && \
    find dist/public/assets -type f | sort | sed 's|dist/public||g' | sed 's/^/    "/;s/$/",/' | sed '$ s/,$//' >> dist/public/assets/manifest.json && \
    echo '  ]' >> dist/public/assets/manifest.json && \
    echo '}' >> dist/public/assets/manifest.json

# Ensure the index.html file is properly copied
RUN cp -f client/index.html dist/public/index.html || echo "No index.html found, skipping"

# Add debugging log for the build process
RUN echo "Contents of dist/public directory:" && ls -la dist/public/
RUN echo "Contents of dist/public/assets directory:" && ls -la dist/public/assets/ || echo "Assets directory empty or not found"

# Create the entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose the application port
EXPOSE 5000

# Set environment variables for production
ENV NODE_ENV=production
ENV DOCKER_ENV=true

# Set entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command
CMD ["npm", "run", "start"]