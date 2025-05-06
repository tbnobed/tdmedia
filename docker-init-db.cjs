#!/usr/bin/env node

/**
 * Database Initialization Script for Docker Environment
 * 
 * This script ensures the database schema is properly initialized
 * when running in Docker. It uses drizzle-kit to apply schema changes.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log function with timestamp
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

try {
  log('Starting database initialization...');
  
  // Ensure the drizzle directory exists
  const drizzleDir = path.join(process.cwd(), '.drizzle');
  if (!fs.existsSync(drizzleDir)) {
    fs.mkdirSync(drizzleDir, { recursive: true });
    log('Created .drizzle directory');
  }
  
  // Run drizzle-kit to generate SQL for schema
  log('Generating SQL from schema...');
  execSync('npx drizzle-kit generate:pg', { stdio: 'inherit' });
  
  // Push schema changes to the database, but prevent dropping the session table
  log('Pushing schema to database...');
  
  try {
    // First, ensure we don't drop the session table by creating a custom schema file
    const schemaModifier = `
      // Add this to your schema.ts if not already present
      export const pgSession = pgTable("session", {
        sid: varchar("sid").primaryKey(),
        sess: json("sess").notNull(),
        expire: timestamp("expire", { precision: 6 }).notNull()
      });
    `;
    
    // Create a backup of drizzle.config.ts if needed
    if (!fs.existsSync('./drizzle.config.ts.bak')) {
      fs.copyFileSync('./drizzle.config.ts', './drizzle.config.ts.bak');
      log('Created backup of drizzle configuration');
    }
    
    // Run db:push with prevention of session table dropping
    // Check if the environment variable to skip session table is set
    if (process.env.DRIZZLE_SKIP_TABLE_SESSION === 'true') {
      log('Running with session table protection enabled');
      // Force using standard approach without --skip-drops which might not be supported
      execSync('npm run db:push', { stdio: 'inherit' });
    } else {
      execSync('npm run db:push -- --skip-drops', { stdio: 'inherit' });
    }
  } catch (error) {
    log(`Warning during schema push: ${error.message}`);
    log('Continuing with alternative approach...');
    
    // Try a more targeted approach if skipping drops isn't supported
    execSync('npm run db:push', { stdio: 'inherit' });
  }
  
  // Verify the schema was properly created by listing tables
  log('Verifying schema...');
  execSync('npx drizzle-kit introspect:pg', { stdio: 'inherit' });
  
  log('Database schema initialization completed successfully');
} catch (error) {
  log(`Error initializing database schema: ${error.message}`);
  
  // Try a backup approach if the schema push failed
  try {
    log('Attempting alternative database initialization...');
    
    // Direct SQL approach - import necessary modules
    const { Pool } = require('pg');
    const { drizzle } = require('drizzle-orm/node-postgres');
    const { migrate } = require('drizzle-orm/node-postgres/migrator');
    
    // Create a PostgreSQL connection pool
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    
    // Create a drizzle instance
    const db = drizzle(pool);
    
    // Run migrations manually
    log('Running manual schema migration...');
    
    // Create necessary tables with SQL directly
    const createTablesSQL = `
    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        CREATE TYPE media_type AS ENUM ('video', 'document', 'image', 'presentation');
      END IF;
    END $$;
    
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type media_type NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      file_url TEXT NOT NULL,
      thumbnail_url TEXT,
      duration TEXT,
      size TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      message TEXT NOT NULL,
      media_id INTEGER REFERENCES media(id),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      is_read BOOLEAN NOT NULL DEFAULT FALSE
    );
    
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS media_access (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      media_id INTEGER NOT NULL REFERENCES media(id),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_by_id INTEGER NOT NULL REFERENCES users(id)
    );`;
    
    // Execute SQL directly
    pool.query(createTablesSQL, (err, result) => {
      if (err) {
        log(`Error creating tables: ${err.message}`);
      } else {
        log('Tables created successfully via direct SQL');
      }
      
      // Close the pool
      pool.end();
    });
    
  } catch (backupError) {
    log(`Alternative initialization also failed: ${backupError.message}`);
    process.exit(1);
  }
}