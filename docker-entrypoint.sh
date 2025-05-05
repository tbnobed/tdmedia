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
  
  # Create a temporary script to check and create admin if needed
  cat > /tmp/check-admin.js << EOF
import { db } from './dist/db/index.js';
import { users } from './dist/shared/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from './dist/server/auth.js';

async function ensureAdminExists() {
  try {
    // Check if admin user exists
    const admin = await db.query.users.findFirst({
      where: eq(users.email, 'admin@example.com')
    });
    
    if (!admin) {
      console.log('Creating admin user...');
      const hashedPassword = await hashPassword('adminpassword');
      
      await db.insert(users).values({
        username: 'admin',
        email: 'admin@example.com',
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
  
  # Create a temporary script to check and create client if needed
  cat > /tmp/check-client.js << EOF
import { db } from './dist/db/index.js';
import { users } from './dist/shared/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from './dist/server/auth.js';

async function ensureClientExists() {
  try {
    // Check if client user exists
    const client = await db.query.users.findFirst({
      where: eq(users.email, 'client@example.com')
    });
    
    if (!client) {
      console.log('Creating client user...');
      const hashedPassword = await hashPassword('demopassword');
      
      await db.insert(users).values({
        username: 'client',
        email: 'client@example.com',
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