#!/usr/bin/env node

// This script is designed to run in a Docker environment to create default users
// It uses CommonJS syntax for better compatibility
const { Pool } = require('pg');
const crypto = require('crypto');
const util = require('util');

// Promisify crypto.scrypt
const scryptAsync = util.promisify(crypto.scrypt);

// Create a PostgreSQL client
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'trilogy_user',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'trilogy_db'
});

// Function to hash password
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

// Function to check and create admin user
async function setupUsers() {
  const client = await pool.connect();
  
  try {
    console.log('Checking for admin user...');
    
    // Check if admin exists
    const adminResult = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [process.env.ADMIN_EMAIL || 'admin@example.com']
    );
    
    // Create admin if not exists
    if (adminResult.rows.length === 0) {
      console.log('Creating admin user...');
      const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
      const adminHashedPassword = await hashPassword(adminPassword);
      
      await client.query(
        'INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, $4)',
        [
          process.env.ADMIN_USERNAME || 'admin',
          process.env.ADMIN_EMAIL || 'admin@example.com',
          adminHashedPassword,
          true
        ]
      );
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
    
    // Check if client exists
    console.log('Checking for client user...');
    const clientResult = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [process.env.CLIENT_EMAIL || 'client@example.com']
    );
    
    // Create client if not exists
    if (clientResult.rows.length === 0) {
      console.log('Creating client user...');
      const clientPassword = process.env.CLIENT_PASSWORD || 'demopassword';
      const clientHashedPassword = await hashPassword(clientPassword);
      
      await client.query(
        'INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, $4)',
        [
          process.env.CLIENT_USERNAME || 'client',
          process.env.CLIENT_EMAIL || 'client@example.com',
          clientHashedPassword,
          false
        ]
      );
      console.log('Client user created successfully');
    } else {
      console.log('Client user already exists');
    }
    
    console.log('User setup completed successfully');
  } catch (error) {
    console.error('Error setting up users:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run setup
setupUsers()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to set up users:', err);
    process.exit(1);
  });