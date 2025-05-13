const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  console.log('Starting content classification migration...');
  const migrationFile = path.join(__dirname, 'content_classification_migration.sql');
  
  try {
    // Read and execute the SQL migration file
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    
    // Connect to the database and begin a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('Executing migration...');
      
      // Run the migration SQL script
      await client.query(migrationSQL);
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Migration completed successfully');
    } catch (error) {
      // If there's an error, roll back the transaction
      await client.query('ROLLBACK');
      console.error('Migration failed:', error);
      throw error;
    } finally {
      // Release the client back to the pool
      client.release();
    }
  } catch (error) {
    console.error('Migration script error:', error);
    process.exit(1);
  } finally {
    // Close the pool
    await pool.end();
  }
}

// Execute the migration
applyMigration().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});