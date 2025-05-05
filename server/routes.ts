import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCategorySchema, insertMediaSchema, insertContactSchema } from "@shared/schema";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import { db } from "@db";
import { sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Health check endpoint for Docker
  app.get("/api/healthcheck", async (req, res) => {
    try {
      // Check database connection
      await db.execute(sql`SELECT 1`);
      res.status(200).json({ status: "ok", message: "Service is healthy" });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({ status: "error", message: "Service unhealthy" });
    }
  });

  // Serve a simple test page for debugging Docker deployment
  app.get("/test-page", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Trilogy Digital Media - Test Page</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
            }
            .card {
              background: #f5f5f5;
              border-radius: 5px;
              padding: 15px;
              margin-bottom: 20px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #2c3e50;
            }
            button {
              background: #3498db;
              color: white;
              border: none;
              padding: 8px 15px;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background: #2980b9;
            }
            #results {
              white-space: pre-wrap;
              background: #eee;
              padding: 10px;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <h1>Trilogy Digital Media - Test Page</h1>
          <div class="card">
            <h2>Server Connection Test</h2>
            <p>This page verifies basic connectivity to the server.</p>
            <p>Current Time: ${new Date().toLocaleString()}</p>
            <p>Environment: ${process.env.NODE_ENV || "Not set"}</p>
          </div>
          
          <div class="card">
            <h2>API Test</h2>
            <button id="testApi">Test API Connection</button>
            <div id="results"></div>
          </div>
          
          <script>
            document.getElementById('testApi').addEventListener('click', async () => {
              const results = document.getElementById('results');
              results.textContent = 'Testing connection...';
              
              try {
                const response = await fetch('/api/debug/info');
                const data = await response.json();
                results.textContent = 'Success! Server response:\\n' + JSON.stringify(data, null, 2);
              } catch (error) {
                results.textContent = 'Error: ' + error.message;
              }
            });
          </script>
        </body>
      </html>
    `);
  });

  // Debug endpoint to get basic app info without authentication
  app.get("/api/debug/info", async (req, res) => {
    try {
      // Collect system information
      const info = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        database: {
          connected: false,
          tables: []
        },
        system: {
          node: process.version,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        }
      };
      
      // Check database
      try {
        await db.execute(sql`SELECT 1`);
        info.database.connected = true;
        
        // Get table counts
        const categoriesCount = await db.execute(sql`SELECT COUNT(*) FROM categories`);
        const mediaCount = await db.execute(sql`SELECT COUNT(*) FROM media`);
        const usersCount = await db.execute(sql`SELECT COUNT(*) FROM users`);
        
        info.database.tables = [
          { name: 'categories', count: categoriesCount.rows[0].count },
          { name: 'media', count: mediaCount.rows[0].count },
          { name: 'users', count: usersCount.rows[0].count }
        ];
      } catch (dbError) {
        console.error("Debug database check failed:", dbError);
      }
      
      res.status(200).json(info);
    } catch (error) {
      console.error("Debug info error:", error);
      res.status(500).json({ 
        status: "error", 
        message: "Failed to get debug info",
        error: String(error)
      });
    }
  });

  // Admin middleware - Check if user is admin
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Type safety check for admin property
    if (!req.user || !(req.user as any).isAdmin) {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    
    next();
  };

  // Auth middleware - Check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  };

  // Categories endpoints
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAdmin, async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const newCategory = await storage.createCategory(validatedData);
      res.status(201).json(newCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertCategorySchema.parse(req.body);
      const updatedCategory = await storage.updateCategory(id, validatedData);
      
      if (!updatedCategory) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Media endpoints
  app.get("/api/media", isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const categoryIdParam = req.query.category as string | undefined;
      const sort = req.query.sort as string | undefined;
      
      const categoryId = categoryIdParam ? parseInt(categoryIdParam) : undefined;
      
      const mediaItems = await storage.getMedia({ search, categoryId, sort });
      res.json(mediaItems);
    } catch (error) {
      console.error("Error fetching media:", error);
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });

  app.get("/api/media/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mediaItem = await storage.getMediaById(id);
      
      if (!mediaItem) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      res.json(mediaItem);
    } catch (error) {
      console.error("Error fetching media item:", error);
      res.status(500).json({ message: "Failed to fetch media item" });
    }
  });

  app.post("/api/media", isAdmin, async (req, res) => {
    try {
      const validatedData = insertMediaSchema.parse(req.body);
      const newMedia = await storage.createMedia(validatedData);
      res.status(201).json(newMedia);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating media:", error);
      res.status(500).json({ message: "Failed to create media" });
    }
  });

  app.put("/api/media/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertMediaSchema.parse(req.body);
      const updatedMedia = await storage.updateMedia(id, validatedData);
      
      if (!updatedMedia) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      res.json(updatedMedia);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating media:", error);
      res.status(500).json({ message: "Failed to update media" });
    }
  });

  app.delete("/api/media/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMedia(id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting media:", error);
      res.status(500).json({ message: "Failed to delete media" });
    }
  });

  // Stream media with watermark
  app.get("/api/stream/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mediaItem = await storage.getMediaById(id);
      
      if (!mediaItem) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // In a real implementation, this would stream the actual file with watermarking
      // For now, we'll secure the URL by adding a signature
      const timestamp = Date.now();
      // Type safety for user ID
      const userId = req.user ? (req.user as any).id : 0;
      const signature = createHmac('sha256', process.env.SESSION_SECRET || 'secure-media-secret')
        .update(`${id}-${timestamp}-${userId}`)
        .digest('hex');
        
      const streamUrl = `/api/raw-stream/${id}?signature=${signature}&timestamp=${timestamp}`;
      
      res.json({ 
        streamUrl,
        mediaType: mediaItem.type,
        title: mediaItem.title
      });
    } catch (error) {
      console.error("Error preparing stream:", error);
      res.status(500).json({ message: "Failed to prepare media stream" });
    }
  });
  
  // Raw streaming endpoint with signature verification
  app.get("/api/raw-stream/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const signature = req.query.signature as string;
      const timestamp = parseInt(req.query.timestamp as string);
      
      // Verify the signature to prevent unauthorized access
      // Type safety for user ID
      const userId = req.user ? (req.user as any).id : 0;
      const expectedSignature = createHmac('sha256', process.env.SESSION_SECRET || 'secure-media-secret')
        .update(`${id}-${timestamp}-${userId}`)
        .digest('hex');
        
      if (signature !== expectedSignature) {
        return res.status(403).json({ message: "Invalid signature" });
      }
      
      // Check if the link has expired (10 minutes)
      const now = Date.now();
      if (now - timestamp > 10 * 60 * 1000) {
        return res.status(410).json({ message: "Stream link expired" });
      }
      
      const mediaItem = await storage.getMediaById(id);
      if (!mediaItem) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // For demonstration, we're returning a placeholder response
      // In a real application, this would stream the actual file with watermarking
      res.send(`
        <html>
          <head>
            <title>Trilogy Digital Media - ${mediaItem.title}</title>
            <style>
              body { 
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f0f0f0;
              }
              .container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
              }
              .watermark {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: rgba(255,255,255,0.3);
                font-size: 30px;
                z-index: 100;
                font-weight: bold;
                pointer-events: none;
              }
              .media-container {
                position: relative;
                width: 100%;
                height: 400px;
                background-color: #000;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${mediaItem.title}</h1>
              <div class="media-container">
                <div class="watermark">TRILOGY DIGITAL</div>
                <div style="color: white; text-align: center;">
                  ${mediaItem.type.toUpperCase()} CONTENT<br>
                  [Secured streaming preview]
                </div>
              </div>
              <p><strong>Description:</strong> ${mediaItem.description}</p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error streaming media:", error);
      res.status(500).json({ message: "Failed to stream media" });
    }
  });

  // Contact form submission
  app.post("/api/contacts", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const newContact = await storage.createContact(validatedData);
      res.status(201).json(newContact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  // Admin contacts endpoint
  app.get("/api/contacts", isAdmin, async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.put("/api/contacts/:id/read", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedContact = await storage.markContactAsRead(id);
      
      if (!updatedContact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      
      res.json(updatedContact);
    } catch (error) {
      console.error("Error marking contact as read:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
