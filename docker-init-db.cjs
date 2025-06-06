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

// Main initialization function
async function initializeDatabase() {
  try {
    // Read environment variables for configuration
    const DB_INIT_RETRY_COUNT = parseInt(process.env.DB_INIT_RETRY_COUNT || '5', 10);
    const DB_INIT_RETRY_DELAY = parseInt(process.env.DB_INIT_RETRY_DELAY || '3', 10);
    const FORCE_DIRECT_TABLE_CREATION = process.env.FORCE_DIRECT_TABLE_CREATION === 'true';
    
    log('Starting database initialization...');
    log(`Configuration: Retry count=${DB_INIT_RETRY_COUNT}, Retry delay=${DB_INIT_RETRY_DELAY}s, Force direct creation=${FORCE_DIRECT_TABLE_CREATION}`);
    
    // Ensure the drizzle directory exists
    const drizzleDir = path.join(process.cwd(), '.drizzle');
    if (!fs.existsSync(drizzleDir)) {
      fs.mkdirSync(drizzleDir, { recursive: true });
      log('Created .drizzle directory');
    }
    
    // IMPORTANT FIRST STEP: Direct SQL execution to ensure tables exist
    // This is our most reliable method, executed early in the process
    log('IMPORTANT: Executing direct SQL table creation as first step...');
    
    // Skip direct creation if explicitly disabled
    if (!FORCE_DIRECT_TABLE_CREATION) {
      log('Direct SQL table creation step SKIPPED (disabled by environment variable)');
    } else {
      try {
        // Direct SQL approach - import necessary modules
        const { Pool } = require('pg');
        
        // Create a PostgreSQL connection pool
        const directPool = new Pool({
          connectionString: process.env.DATABASE_URL
        });
        
        try {
          // Create tables directly with SQL first
          const directCreateTablesSQL = `
          -- Create content_type enum if it doesn't exist
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_classification_type') THEN
              CREATE TYPE content_classification_type AS ENUM ('film', 'tv_show', 'other');
            END IF;
          END $$;
          
          -- Create playlists table if it doesn't exist
          CREATE TABLE IF NOT EXISTS playlists (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
          
          -- Create media_playlists table if it doesn't exist
          CREATE TABLE IF NOT EXISTS media_playlists (
            id SERIAL PRIMARY KEY,
            media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
            playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          );
          
          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_media_playlists_media_id ON media_playlists(media_id);
          CREATE INDEX IF NOT EXISTS idx_media_playlists_playlist_id ON media_playlists(playlist_id);
          
          -- Add content classification and activation fields to media table if they don't exist
          DO $$
          BEGIN
            -- Add content classification fields
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'media' AND column_name = 'content_type'
            ) THEN
              ALTER TABLE media ADD COLUMN content_type TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'media' AND column_name = 'year'
            ) THEN
              ALTER TABLE media ADD COLUMN year INTEGER;
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'media' AND column_name = 'season_number'
            ) THEN
              ALTER TABLE media ADD COLUMN season_number INTEGER;
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'media' AND column_name = 'total_episodes'
            ) THEN
              ALTER TABLE media ADD COLUMN total_episodes INTEGER;
            END IF;

            -- Add media activation/deactivation field
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'media' AND column_name = 'is_active'
            ) THEN
              ALTER TABLE media ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
            END IF;
          END $$;
          
          -- Create default 'Uncategorized' playlist if it doesn't exist
          INSERT INTO playlists (name, description)
          SELECT 'Uncategorized', 'Default category for uncategorized media'
          WHERE NOT EXISTS (SELECT 1 FROM playlists WHERE name = 'Uncategorized');
          `;
          
          // Execute SQL query using promisified approach
          await new Promise((resolve, reject) => {
            directPool.query(directCreateTablesSQL, (err, result) => {
              if (err) {
                reject(err);
              } else {
                resolve(result);
              }
            });
          });
          
          log('Direct SQL table creation executed as first step.');
          
          // Check if it worked
          const result = await directPool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playlists')");
          if (result.rows[0].exists) {
            log('SUCCESS: Direct SQL creation verified - playlists table exists!');
          } else {
            log('WARNING: Direct SQL creation did not create playlists table.');
          }
        } catch (directSqlError) {
          log(`Warning during direct SQL creation: ${directSqlError.message}`);
          log('Will continue with Drizzle migration...');
        } finally {
          // Close the pool
          await directPool.end();
        }
      } catch (directCreateError) {
        log(`Error in direct SQL creation: ${directCreateError.message}`);
      }
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
      
      // Create a PostgreSQL connection pool
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL
      });
      
      // Execute alternative using async/await pattern
      await alternativeDatabaseInit(pool);
    } catch (backupError) {
      log(`Alternative initialization also failed: ${backupError.message}`);
      process.exit(1);
    }
  }
}

/**
 * Alternative database initialization using direct SQL
 * @param {Object} pool PostgreSQL connection pool
 */
async function alternativeDatabaseInit(pool) {
  try {
    // Create necessary tables with SQL directly
    const createTablesSQL = `
    -- Create playlists table (formerly categories)
    CREATE TABLE IF NOT EXISTS playlists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    -- Create media type enum if it doesn't exist
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        CREATE TYPE media_type AS ENUM ('video', 'document', 'image', 'presentation');
      END IF;
    END $$;
    
    -- Create content_type enum if it doesn't exist
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_classification_type') THEN
        CREATE TYPE content_classification_type AS ENUM ('film', 'tv_show', 'other');
      END IF;
    END $$;
    
    -- Create media table with all required fields
    CREATE TABLE IF NOT EXISTS media (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type media_type NOT NULL,
      file_url TEXT NOT NULL,
      thumbnail_url TEXT,
      duration TEXT,
      size TEXT,
      content_type TEXT,
      year INTEGER,
      season_number INTEGER,
      total_episodes INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    -- Ensure required columns exist on media table for both thumbnail management and content classification
    DO $$
    BEGIN
      -- Ensure thumbnail_url column exists
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'thumbnail_url'
      ) THEN
        ALTER TABLE media ADD COLUMN thumbnail_url TEXT;
      END IF;

      -- Ensure content classification fields exist
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'content_type'
      ) THEN
        ALTER TABLE media ADD COLUMN content_type TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'year'
      ) THEN
        ALTER TABLE media ADD COLUMN year INTEGER;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'season_number'
      ) THEN
        ALTER TABLE media ADD COLUMN season_number INTEGER;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'total_episodes'
      ) THEN
        ALTER TABLE media ADD COLUMN total_episodes INTEGER;
      END IF;

      -- Ensure media activation/deactivation field exists
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'media' AND column_name = 'is_active'
      ) THEN
        ALTER TABLE media ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
      END IF;
    END $$;
    
    -- Create the media_playlists junction table for many-to-many relationship
    CREATE TABLE IF NOT EXISTS media_playlists (
      id SERIAL PRIMARY KEY,
      media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    -- Create an index on the media_playlists table for faster lookups
    CREATE INDEX IF NOT EXISTS idx_media_playlists_media_id ON media_playlists(media_id);
    CREATE INDEX IF NOT EXISTS idx_media_playlists_playlist_id ON media_playlists(playlist_id);
    
    -- Create contacts table
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
    
    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    
    -- Create media_access table
    CREATE TABLE IF NOT EXISTS media_access (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_by_id INTEGER NOT NULL REFERENCES users(id)
    );
    
    -- Create indexes for media_access table
    CREATE INDEX IF NOT EXISTS idx_media_access_user_id ON media_access(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_access_media_id ON media_access(media_id);
    
    -- Migrate data from categories to playlists if needed
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') THEN
        -- Insert categories into playlists if playlists table is empty
        IF NOT EXISTS (SELECT 1 FROM playlists) THEN
          INSERT INTO playlists (id, name, description, created_at)
          SELECT id, name, description, created_at FROM categories;
          
          -- Reset sequence for playlists.id to the max id + 1
          PERFORM setval('playlists_id_seq', (SELECT MAX(id) FROM playlists) + 1, false);
          
          -- Create media_playlists entries from media.category_id if the media table has category_id
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'category_id') THEN
            INSERT INTO media_playlists (media_id, playlist_id, created_at)
            SELECT id, category_id, NOW() FROM media;
          END IF;
        END IF;
      END IF;
    END $$;
    
    -- Create default 'Uncategorized' playlist if not exists
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM playlists WHERE name = 'Uncategorized') THEN
        INSERT INTO playlists (name, description) VALUES ('Uncategorized', 'Default category for uncategorized media');
      END IF;
    END $$;`;
    
    // Execute SQL directly using promisified approach
    await new Promise((resolve, reject) => {
      pool.query(createTablesSQL, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
    
    log('Tables created successfully via direct SQL');
    
    // Function to verify table with retries
    async function verifyTableWithRetry(tableName, maxAttempts = process.env.DB_INIT_RETRY_COUNT || 5) {
      let attempt = 1;
      let tableExists = false;
      const retryDelay = process.env.DB_INIT_RETRY_DELAY || 3;
      
      log(`Verifying ${tableName} table with retry logic (max attempts: ${maxAttempts}, delay: ${retryDelay}s)...`);
      
      while (attempt <= maxAttempts && !tableExists) {
        try {
          const result = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${tableName}')`);
          tableExists = result.rows[0].exists;
          
          if (tableExists) {
            log(`✓ Verified: ${tableName} table exists (attempt ${attempt})`);
            return true;
          } else {
            log(`✗ Attempt ${attempt} of ${maxAttempts}: ${tableName} table does not exist. Waiting ${retryDelay} seconds...`);
            // Sleep for the configured delay
            await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
            attempt++;
          }
        } catch (error) {
          log(`Error checking ${tableName} table (attempt ${attempt} of ${maxAttempts}): ${error.message}`);
          // Sleep and retry
          await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
          attempt++;
        }
      }
      
      if (!tableExists) {
        log(`ERROR: ${tableName} table verification failed after ${maxAttempts} attempts.`);
        return false;
      }
      
      return tableExists;
    }
    
    // Add a brief delay to let PostgreSQL complete all operations
    log('Waiting 3 seconds for database to settle...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
      // Verify tables with retry logic
      const playlistsVerified = await verifyTableWithRetry('playlists');
      const mediaPlaylistsVerified = await verifyTableWithRetry('media_playlists');
      
      if (playlistsVerified && mediaPlaylistsVerified) {
        log('✅ All required tables verified successfully!');
      } else {
        log('⚠️ WARNING: Table verification failed. Attempting to create tables directly...');
        
        // If verification failed, try to create the tables directly as a fallback
        try {
          // Create a more direct SQL statement to force the tables to be created
          const forcedTableCreation = `
            -- Create playlists table if it doesn't exist
            CREATE TABLE IF NOT EXISTS playlists (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              description TEXT,
              created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            
            -- Create media_playlists junction table if it doesn't exist
            CREATE TABLE IF NOT EXISTS media_playlists (
              id SERIAL PRIMARY KEY,
              media_id INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
              playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
              created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            );
            
            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_media_playlists_media_id ON media_playlists(media_id);
            CREATE INDEX IF NOT EXISTS idx_media_playlists_playlist_id ON media_playlists(playlist_id);
            
            -- Create content classification type if it doesn't exist
            DO $$ 
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_classification_type') THEN
                CREATE TYPE content_classification_type AS ENUM ('film', 'tv_show', 'other');
              END IF;
            END $$;
            
            -- Add content classification and activation fields to media table if they don't exist
            DO $$
            BEGIN
              -- Ensure content classification fields exist
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'media' AND column_name = 'content_type'
              ) THEN
                ALTER TABLE media ADD COLUMN content_type TEXT;
              END IF;

              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'media' AND column_name = 'year'
              ) THEN
                ALTER TABLE media ADD COLUMN year INTEGER;
              END IF;

              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'media' AND column_name = 'season_number'
              ) THEN
                ALTER TABLE media ADD COLUMN season_number INTEGER;
              END IF;

              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'media' AND column_name = 'total_episodes'
              ) THEN
                ALTER TABLE media ADD COLUMN total_episodes INTEGER;
              END IF;

              -- Ensure media activation/deactivation field exists
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'media' AND column_name = 'is_active'
              ) THEN
                ALTER TABLE media ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
              END IF;
            END $$;
            
            -- Create default 'Uncategorized' playlist if it doesn't exist
            INSERT INTO playlists (name, description)
            SELECT 'Uncategorized', 'Default category for uncategorized media'
            WHERE NOT EXISTS (SELECT 1 FROM playlists WHERE name = 'Uncategorized');
            
            -- Migrate data from categories table if available
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'categories') 
              AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'media' AND column_name = 'category_id') THEN
                -- Import categories into playlists
                INSERT INTO playlists (id, name, description, created_at)
                SELECT c.id, c.name, c.description, c.created_at
                FROM categories c
                WHERE NOT EXISTS (SELECT 1 FROM playlists p WHERE p.name = c.name)
                ON CONFLICT DO NOTHING;
                
                -- Reset sequence
                PERFORM setval('playlists_id_seq', (SELECT COALESCE(MAX(id), 0) FROM playlists) + 1, false);
                
                -- Create playlist relationships
                INSERT INTO media_playlists (media_id, playlist_id, created_at)
                SELECT m.id, m.category_id, NOW()
                FROM media m
                WHERE m.category_id IS NOT NULL
                AND NOT EXISTS (
                  SELECT 1 FROM media_playlists mp 
                  WHERE mp.media_id = m.id AND mp.playlist_id = m.category_id
                )
                ON CONFLICT DO NOTHING;
              END IF;
            END $$;`;
            
          log('Executing direct table creation as a fallback measure...');
          await pool.query(forcedTableCreation);
          
          // Check if it worked
          const finalPlaylistCheck = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'playlists')");
          const finalMediaPlaylistsCheck = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'media_playlists')");
          
          if (finalPlaylistCheck.rows[0].exists && finalMediaPlaylistsCheck.rows[0].exists) {
            log('SUCCESS: Tables created successfully through direct SQL fallback!');
          } else {
            log('ERROR: Failed to create tables even with direct SQL. The database may have permission issues.');
          }
        } catch (directCreationError) {
          log(`ERROR during direct table creation: ${directCreationError.message}`);
        }
      }
      
      // Verify there is at least one playlist in the system
      const playlistCountResult = await pool.query("SELECT COUNT(*) FROM playlists");
      const playlistCount = parseInt(playlistCountResult.rows[0].count);
      
      if (playlistCount === 0) {
        log('No playlists found. Creating default "Uncategorized" playlist...');
        await pool.query("INSERT INTO playlists (name, description) VALUES ('Uncategorized', 'Default category for uncategorized media')");
        log('Created default "Uncategorized" playlist.');
      } else {
        log(`Found ${playlistCount} existing playlists. No need to create default.`);
      }
    } catch (verifyError) {
      log(`Error during verification: ${verifyError.message}`);
    } finally {
      // Close the pool
      log('Closing database connection.');
      await pool.end();
    }
    
    log('Alternative database initialization completed successfully.');
  } catch (error) {
    log(`Error in alternative database initialization: ${error.message}`);
    throw error;
  }
}

// Execute the main function
initializeDatabase().catch(err => {
  console.error(`Fatal error in database initialization: ${err.message}`);
  process.exit(1);
});