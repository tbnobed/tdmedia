#!/usr/bin/env node

/**
 * User Setup Script for Docker Environment
 * 
 * This script creates the default admin and client user accounts
 * when running in Docker.
 */

const { Pool } = require('pg');
const { scrypt, randomBytes } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);

// Log function with timestamp
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Password hashing function similar to the one in auth.ts
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function setupUsers() {
  log('Starting user setup...');
  
  // Create a PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    // Get admin credentials from environment variables
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword';
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    
    // Get client credentials from environment variables
    const clientEmail = process.env.CLIENT_EMAIL || 'client@example.com';
    const clientPassword = process.env.CLIENT_PASSWORD || 'demopassword';
    const clientUsername = process.env.CLIENT_USERNAME || 'client';
    
    // Check if admin user already exists
    const adminResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [adminEmail]
    );
    
    // Create admin user if it doesn't exist
    if (adminResult.rows.length === 0) {
      log(`Creating admin user: ${adminEmail}`);
      const hashedAdminPassword = await hashPassword(adminPassword);
      
      await pool.query(
        'INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, $4)',
        [adminUsername, adminEmail, hashedAdminPassword, true]
      );
      
      log('Admin user created successfully');
    } else {
      log('Admin user already exists');
    }
    
    // Check if client user already exists
    const clientResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [clientEmail]
    );
    
    // Create client user if it doesn't exist
    if (clientResult.rows.length === 0) {
      log(`Creating client user: ${clientEmail}`);
      const hashedClientPassword = await hashPassword(clientPassword);
      
      await pool.query(
        'INSERT INTO users (username, email, password, is_admin) VALUES ($1, $2, $3, $4)',
        [clientUsername, clientEmail, hashedClientPassword, false]
      );
      
      log('Client user created successfully');
    } else {
      log('Client user already exists');
    }
    
    // Create 'postgres' user if it doesn't exist (for external tools)
    try {
      const postgresUserResult = await pool.query(
        "SELECT 1 FROM pg_roles WHERE rolname = 'postgres'"
      );
      
      if (postgresUserResult.rows.length === 0) {
        log('Creating postgres superuser role for compatibility...');
        const postgresPassword = process.env.POSTGRES_PASSWORD || 'postgres';
        
        await pool.query(
          `CREATE USER postgres WITH SUPERUSER PASSWORD '${postgresPassword}'`
        );
        
        log('postgres superuser role created successfully');
      } else {
        log('postgres superuser role already exists');
      }
    } catch (postgresUserError) {
      log(`Note: Could not create postgres user - ${postgresUserError.message}`);
    }
    
    // Create a default playlist if none exist
    try {
      const playlistResult = await pool.query('SELECT id FROM playlists');
      
      if (playlistResult.rows.length === 0) {
        log('Creating default playlist');
        
        await pool.query(
          'INSERT INTO playlists (name, description) VALUES ($1, $2)',
          ['Uncategorized', 'Default playlist for uncategorized media']
        );
        
        log('Default playlist created successfully');
      }
    } catch (playlistError) {
      // Gracefully handle if playlists table doesn't yet exist
      log(`Note: Playlist check skipped - ${playlistError.message}`);
    }
    
    log('User setup completed successfully');
  } catch (error) {
    log(`Error setting up users: ${error.message}`);
    throw error;
  } finally {
    // Close the database connection
    pool.end();
  }
}

// Run the setup
setupUsers().catch(error => {
  log(`Failed to set up users: ${error.message}`);
  process.exit(1);
});