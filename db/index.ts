import * as schema from "@shared/schema";
import ws from 'ws';

// Determine if we should use the Neon client or standard pg driver
const useNeonClient = process.env.USE_NEON_CLIENT === 'true'; 
const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';

// Create database connection
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let pool;
let db;

if (isDocker || process.env.USE_NEON_CLIENT === 'false') {
  // Use standard pg driver for Docker environments
  const { Pool } = require('pg');
  const { drizzle: pgDrizzle } = require('drizzle-orm/node-postgres');
  
  console.log('Using standard PostgreSQL client (pg) instead of Neon serverless');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = pgDrizzle(pool, { schema });
} else {
  // Use Neon serverless for development environments like Replit
  const { Pool: NeonPool, neonConfig } = require('@neondatabase/serverless');
  const { drizzle: neonDrizzle } = require('drizzle-orm/neon-serverless');
  
  // This is required for the Neon serverless driver
  neonConfig.webSocketConstructor = ws;
  
  console.log('Using Neon serverless client for development environment');
  pool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  db = neonDrizzle(pool, { schema });
}

export { pool, db };