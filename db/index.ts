import { Pool as PgPool } from 'pg';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

// Check if we're running in Docker environment
const isDocker = process.env.DOCKER_ENV === 'true';

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let dbPool: PgPool | NeonPool;
let dbClient: any;

// Use different database connection method based on environment
if (isDocker) {
  console.log("Using standard PostgreSQL client for Docker environment");
  dbPool = new PgPool({
    connectionString: process.env.DATABASE_URL,
    // Disable SSL for local Docker connections
    ssl: false
  });
  dbClient = drizzle(dbPool, { schema });
} else {
  console.log("Using Neon serverless PostgreSQL client");
  // This is the correct way neon config - DO NOT change this
  neonConfig.webSocketConstructor = ws;
  dbPool = new NeonPool({ connectionString: process.env.DATABASE_URL });
  dbClient = drizzleNeon({ client: dbPool, schema });
}

export const pool = dbPool;
export const db = dbClient;