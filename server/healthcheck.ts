import { Express } from 'express';
import { pool } from '../db';

/**
 * Setup health check endpoints for the application
 * These endpoints are used by Docker health checks and monitoring tools
 */
export function setupHealthChecks(app: Express): void {
  // Basic health check that always returns 200 OK
  app.get('/api/healthcheck', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Database health check that verifies the database connection
  app.get('/api/healthcheck/db', async (req, res) => {
    try {
      // Test the database connection
      const client = await pool.connect();
      try {
        const result = await client.query('SELECT 1 as test');
        res.status(200).json({
          status: 'ok',
          database: 'connected',
          result: result.rows[0],
          timestamp: new Date().toISOString()
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Health check database error:', error);
      res.status(500).json({
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    }
  });
}