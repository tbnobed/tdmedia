#!/usr/bin/env node

// This script initializes the database tables for the Docker environment
// It manually creates the required tables without relying on drizzle-kit
const { Pool } = require('pg');

// Create PostgreSQL client
const pool = new Pool({
  user: process.env.POSTGRES_USER || 'trilogy_user',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'trilogy_db'
});

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Initializing database schema...');
    
    // Create database tables
    await client.query(`
      -- Create enum type for media types
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
          CREATE TYPE media_type AS ENUM ('video', 'document', 'image', 'presentation');
        END IF;
      END 
      $$;

      -- Create users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create categories table
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create media table
      CREATE TABLE IF NOT EXISTS media (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        category_id INTEGER REFERENCES categories(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Create contacts table
      CREATE TABLE IF NOT EXISTS contacts (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        message TEXT NOT NULL,
        media_id INTEGER REFERENCES media(id),
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Check if we should seed categories
    const categoriesResult = await client.query('SELECT COUNT(*) FROM categories');
    if (parseInt(categoriesResult.rows[0].count) === 0) {
      console.log('Seeding default categories...');
      
      await client.query(`
        INSERT INTO categories (name, description) VALUES
        ('Marketing', 'Marketing and promotional materials'),
        ('Training', 'Training and educational resources'),
        ('Product', 'Product demonstrations and documentation'),
        ('Corporate', 'Corporate communications and presentations')
      `);
      
      console.log('Categories seeded successfully');
    }
    
    // Check if we should seed media
    const mediaResult = await client.query('SELECT COUNT(*) FROM media');
    if (parseInt(mediaResult.rows[0].count) === 0) {
      console.log('Seeding sample media...');
      
      await client.query(`
        INSERT INTO media (title, description, type, file_path, thumbnail_path, category_id) VALUES
        ('Corporate Overview', 'An overview of our company and services', 'video', '/media/corporate_overview.mp4', '/media/thumbnails/corporate_overview.jpg', 4),
        ('Q1 Sales Report', 'Quarterly sales report for Q1 2025', 'document', '/media/q1_sales_report.pdf', '/media/thumbnails/q1_sales_report.jpg', 1),
        ('Marketing Presentation', 'Presentation for the new marketing campaign', 'presentation', '/media/marketing_presentation.pptx', '/media/thumbnails/marketing_presentation.jpg', 1),
        ('Product Demo', 'Demonstration of our flagship product', 'video', '/media/product_demo.mp4', '/media/thumbnails/product_demo.jpg', 3),
        ('Training Manual', 'Employee training manual', 'document', '/media/training_manual.pdf', '/media/thumbnails/training_manual.jpg', 2),
        ('Brand Guidelines', 'Official brand guidelines and assets', 'image', '/media/brand_guidelines.png', '/media/thumbnails/brand_guidelines.jpg', 1)
      `);
      
      console.log('Media seeded successfully');
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run initialization
initDatabase()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });