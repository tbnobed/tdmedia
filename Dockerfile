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

# Copy static files to the dist directory
RUN cp -f client/public/docker-config.js dist/public/config.js || echo "No docker config found, skipping"

# Ensure the index.html file is properly copied
RUN mkdir -p dist/public
RUN cp -f client/index.html dist/public/index.html || echo "No index.html found, skipping"

# Add debugging log for the build process
RUN echo "Contents of dist/public directory:" && ls -la dist/public/

# Create the entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose the application port
EXPOSE 5000

# Set environment variables for production
ENV NODE_ENV=production

# Set entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command
CMD ["npm", "run", "start"]