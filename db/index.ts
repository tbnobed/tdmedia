import * as schema from "@shared/schema";
import ws from 'ws';
import pg from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

// Determine if we should use the Neon client or standard pg driver
const useNeonClient = process.env.USE_NEON_CLIENT === 'true'; 
const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';

// Create database connection
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// This is required for the Neon serverless driver
neonConfig.webSocketConstructor = ws;

let pool;
let db;
let isNeonClient = false;

// Use the correct client based on environment
if (isDocker || process.env.USE_NEON_CLIENT === 'false') {
  console.log('Using standard PostgreSQL client (pg) instead of Neon serverless');
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle(pool, { schema });
  isNeonClient = false;
} else {
  console.log('Using Neon serverless client for development environment');
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle(pool, { schema });
  isNeonClient = true;
}

// Function to help with SQL query execution for both Neon and regular PostgreSQL
async function executeRawSQL(queryText: string, values: any[] = []) {
  if (isNeonClient) {
    // For Neon client, we must use pool.query directly
    return await pool.query(queryText, values);
  } else {
    // For standard PostgreSQL with drizzle, we need to construct the SQL query with parameter placeholders
    // This is a simplified approach and may need to be expanded for more complex queries
    const query = {
      text: queryText,
      values: values
    };
    return await db.execute(query);
  }
}

export { pool, db, executeRawSQL };