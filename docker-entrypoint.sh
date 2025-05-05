#!/bin/sh
set -e

echo "Waiting for PostgreSQL to become available..."

# Wait for PostgreSQL to be available
RETRIES=30
until pg_isready -h postgres -U ${POSTGRES_USER:-trilogy_user} -d ${POSTGRES_DB:-trilogy_db} || [ $RETRIES -eq 0 ]; do
  echo "Waiting for PostgreSQL ($RETRIES retries left)..."
  RETRIES=$((RETRIES-1))
  sleep 1
done

if [ $RETRIES -eq 0 ]; then
  echo "Error: PostgreSQL not available"
  exit 1
fi

echo "PostgreSQL is ready!"

# Initialize the database schema
echo "Initializing database schema..."
npm run db:push

echo "Database schema initialized successfully!"

# Check if admin user exists, create if not
echo "Checking for admin user..."
NODE_PATH=/app node -e "
const { db } = require('./db');
const { users, eq } = require('./shared/schema');

async function checkAndCreateAdmin() {
  try {
    const admin = await db.query.users.findFirst({
      where: eq(users.email, process.env.ADMIN_EMAIL || 'admin@example.com')
    });
    
    if (!admin) {
      const { hashPassword } = require('./server/auth');
      const hashedPassword = await hashPassword(process.env.ADMIN_PASSWORD || 'adminpassword');
      
      await db.insert(users).values({
        username: process.env.ADMIN_USERNAME || 'admin',
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: hashedPassword,
        isAdmin: true
      });
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
    
    const client = await db.query.users.findFirst({
      where: eq(users.email, process.env.CLIENT_EMAIL || 'client@example.com')
    });
    
    if (!client) {
      const { hashPassword } = require('./server/auth');
      const hashedPassword = await hashPassword(process.env.CLIENT_PASSWORD || 'demopassword');
      
      await db.insert(users).values({
        username: process.env.CLIENT_USERNAME || 'client',
        email: process.env.CLIENT_EMAIL || 'client@example.com',
        password: hashedPassword,
        isAdmin: false
      });
      console.log('Client user created successfully');
    } else {
      console.log('Client user already exists');
    }
  } catch (error) {
    console.error('Error checking/creating users:', error);
  }
}

checkAndCreateAdmin().then(() => process.exit(0));
"

# Start the application
echo "Starting the application..."
exec "$@"