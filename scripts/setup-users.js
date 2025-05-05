// CommonJS script for creating default users
const { db } = require('../db');
const { users } = require('../shared/schema');
const { eq } = require('drizzle-orm');
const { hashPassword } = require('../server/auth');

async function setupDefaultUsers() {
  try {
    console.log('Checking for admin user...');
    const admin = await db.query.users.findFirst({
      where: eq(users.email, process.env.ADMIN_EMAIL || 'admin@example.com')
    });
    
    if (!admin) {
      console.log('Creating admin user...');
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
    
    console.log('Checking for client user...');
    const client = await db.query.users.findFirst({
      where: eq(users.email, process.env.CLIENT_EMAIL || 'client@example.com')
    });
    
    if (!client) {
      console.log('Creating client user...');
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
    
    console.log('User setup completed successfully');
  } catch (error) {
    console.error('Error setting up users:', error);
    process.exit(1);
  }
}

// Run the function
setupDefaultUsers()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to set up users:', err);
    process.exit(1);
  });