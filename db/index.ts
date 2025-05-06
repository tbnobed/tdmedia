import * as schema from "@shared/schema";
import { sql } from 'drizzle-orm';

// Check database connection type based on URL
const isNeonDatabase = process.env.DATABASE_URL?.includes('neon.tech') || false;

// Create database connection
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Dynamic imports to handle different database drivers
let pool: any;
let db: any;

// Initialize database connection
async function initDb() {
  if (isNeonDatabase) {
    // For Neon Serverless PostgreSQL (cloud)
    console.log('Using Neon serverless client');
    
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle: drizzleNeon } = await import('drizzle-orm/neon-serverless');
    const ws = await import('ws');
    
    // This is the correct way neon config - DO NOT change this
    neonConfig.webSocketConstructor = ws.default;
    
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzleNeon({ client: pool, schema });
  } else {
    // For standard PostgreSQL (local or Docker)
    console.log('Using standard PostgreSQL client');
    
    const pg = await import('pg');
    const postgres = await import('postgres');
    const { drizzle: drizzlePg } = await import('drizzle-orm/postgres-js');
    
    // Connect to PostgreSQL
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const pgClient = postgres.default(process.env.DATABASE_URL);
    db = drizzlePg(pgClient, { schema });
  }
}

// Initialize database connection
initDb().catch(error => {
  console.error('Failed to initialize database connection:', error);
  process.exit(1);
});

export { pool, db };