const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Create a PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  console.log('Starting language field migration...');
  const migrationFile = path.join(__dirname, 'language_field_migration.sql');
  
  try {
    // Read and execute the SQL migration file
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');
    
    // Connect to the database and begin a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      console.log('Executing language field migration...');
      
      // Run the migration SQL script
      await client.query(migrationSQL);
      
      // Commit the transaction
      await client.query('COMMIT');
      console.log('Language field migration completed successfully');
    } catch (error) {
      // If there's an error, roll back the transaction
      await client.query('ROLLBACK');
      console.error('Language field migration failed:', error);
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