import * as schema from "@shared/schema";
import ws from 'ws';
import pg from 'pg';
import { drizzle as pgDrizzle } from 'drizzle-orm/node-postgres';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';

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

// Use the correct client based on environment
if (isDocker || process.env.USE_NEON_CLIENT === 'false') {
  console.log('Using standard PostgreSQL client (pg) instead of Neon serverless');
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle(pool, { schema });
} else {
  console.log('Using Neon serverless client for development environment');
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle(pool, { schema });
}

export { pool, db };