FROM node:20-alpine

WORKDIR /app

# Install dependencies for building and running
RUN apk add --no-cache python3 make g++ 

# Install dependencies first (leverage Docker cache)
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Create directory for media files
RUN mkdir -p /app/media

# Create the entrypoint script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Expose the application port
EXPOSE 5000

# Set entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command
CMD ["npm", "run", "start"]