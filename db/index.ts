import * as schema from "@shared/schema";
import { sql } from 'drizzle-orm';

// Check if we're in production Docker environment
const isProduction = process.env.NODE_ENV === 'production';

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
  if (isProduction) {
    // In Docker production, use standard pg Pool
    const pg = await import('pg');
    const postgres = await import('postgres');
    const { drizzle: drizzlePg } = await import('drizzle-orm/postgres-js');
    
    // Ensure connection string exists
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set for production environment");
    }
    
    // Connect to PostgreSQL
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const sql = postgres.default(process.env.DATABASE_URL);
    db = drizzlePg(sql, { schema });
    
    console.log('Using PostgreSQL client for production environment');
  } else {
    // In development, use Neon serverless driver
    const { Pool, neonConfig } = await import('@neondatabase/serverless');
    const { drizzle: drizzleNeon } = await import('drizzle-orm/neon-serverless');
    const ws = await import('ws');
    
    // This is the correct way neon config - DO NOT change this
    neonConfig.webSocketConstructor = ws.default;
    
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzleNeon({ client: pool, schema });
    
    console.log('Using Neon serverless client for development environment');
  }
}

// Initialize database connection
initDb().catch(error => {
  console.error('Failed to initialize database connection:', error);
  process.exit(1);
});

export { pool, db };