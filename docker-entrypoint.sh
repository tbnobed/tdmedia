#!/bin/sh
set -e

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
  echo "Waiting for PostgreSQL to become available..."
  
  RETRIES=30
  until [ $RETRIES -eq 0 ] || pg_isready -h postgres -U trilogy_user -d trilogy_db; do
    echo "Waiting for PostgreSQL ($((RETRIES--)) retries left)..."
    sleep 1
  done
  
  if [ $RETRIES -eq 0 ]; then
    echo "Error: Could not connect to PostgreSQL" >&2
    exit 1
  fi
  
  echo "PostgreSQL is ready!"
}

# Function to initialize the database schema
initialize_db() {
  echo "Initializing database schema..."
  npm run db:push
  
  # Check if database was successfully initialized
  if [ $? -ne 0 ]; then
    echo "Error: Failed to initialize database schema" >&2
    exit 1
  fi
  
  echo "Database schema initialized successfully!"
}

# Function to create default admin user if it doesn't exist
create_admin_user() {
  echo "Checking for admin user..."
  
  # Set default admin values if environment variables are not set
  ADMIN_EMAIL=${ADMIN_EMAIL:-admin@example.com}
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-adminpassword}
  ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
  
  # Create a temporary script to check and create admin if needed
  cat > /tmp/check-admin.js << EOF
import { db } from './dist/db/index.js';
import { users } from './dist/shared/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from './dist/server/auth.js';

async function ensureAdminExists() {
  try {
    // Get admin details from environment variables
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    
    // Check if admin user exists
    const admin = await db.query.users.findFirst({
      where: eq(users.email, adminEmail)
    });
    
    if (!admin) {
      console.log('Creating admin user...');
      const hashedPassword = await hashPassword(adminPassword);
      
      await db.insert(users).values({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true
      });
      
      console.log('Admin user created successfully!');
    } else {
      console.log('Admin user already exists.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

ensureAdminExists();
EOF

  # Execute the temporary script
  node --experimental-specifier-resolution=node /tmp/check-admin.js
  
  # Check if admin user was successfully created or already exists
  if [ $? -ne 0 ]; then
    echo "Error: Failed to ensure admin user exists" >&2
    exit 1
  fi
}

# Function to create default client user if it doesn't exist
create_client_user() {
  echo "Checking for client user..."
  
  # Set default client values if environment variables are not set
  CLIENT_EMAIL=${CLIENT_EMAIL:-client@example.com}
  CLIENT_PASSWORD=${CLIENT_PASSWORD:-demopassword}
  CLIENT_USERNAME=${CLIENT_USERNAME:-client}
  
  # Create a temporary script to check and create client if needed
  cat > /tmp/check-client.js << EOF
import { db } from './dist/db/index.js';
import { users } from './dist/shared/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from './dist/server/auth.js';

async function ensureClientExists() {
  try {
    // Get client details from environment variables
    const clientEmail = process.env.CLIENT_EMAIL || 'client@example.com';
    const clientPassword = process.env.CLIENT_PASSWORD || 'demopassword';
    const clientUsername = process.env.CLIENT_USERNAME || 'client';
    
    // Check if client user exists
    const client = await db.query.users.findFirst({
      where: eq(users.email, clientEmail)
    });
    
    if (!client) {
      console.log('Creating client user...');
      const hashedPassword = await hashPassword(clientPassword);
      
      await db.insert(users).values({
        username: clientUsername,
        email: clientEmail,
        password: hashedPassword,
        isAdmin: false
      });
      
      console.log('Client user created successfully!');
    } else {
      console.log('Client user already exists.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error creating client user:', error);
    process.exit(1);
  }
}

ensureClientExists();
EOF

  # Execute the temporary script
  node --experimental-specifier-resolution=node /tmp/check-client.js
  
  # Check if client user was successfully created or already exists
  if [ $? -ne 0 ]; then
    echo "Error: Failed to ensure client user exists" >&2
    exit 1
  fi
}

# Execute the initialization procedures
wait_for_postgres
initialize_db
create_admin_user
create_client_user

# Run the command passed to docker
echo "Starting application..."
exec "$@"