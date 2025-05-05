FROM node:20-alpine

WORKDIR /app

# Install dependencies for building and running
RUN apk add --no-cache python3 make g++ postgresql-client

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

# Move build assets to the assets directory for discovery
RUN find dist/client/assets -type f -name "*.js" -o -name "*.css" -exec cp {} dist/public/assets/ \; || echo "No built assets found"

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