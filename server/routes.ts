import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCategorySchema, insertMediaSchema, insertContactSchema } from "@shared/schema";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import multer from "multer";
import { db } from "@db";
import { sql } from "drizzle-orm";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'media');

// Create the upload directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for uploaded files
const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// Set up file filter for allowed media types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define allowed file types
  const allowedTypes: Record<string, boolean> = {
    // Image files
    'image/jpeg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    // Document files
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
    // Presentation files
    'application/vnd.ms-powerpoint': true,
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
    // Video files
    'video/mp4': true,
    'video/webm': true,
    'video/quicktime': true
  };

  if (file.mimetype in allowedTypes) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Allowed types: images, documents, presentations, and videos.'));
  }
};

// Configure upload middleware
const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
  },
  fileFilter: fileFilter
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // Asset listing endpoint for frontend initialization
  app.get("/assets/", (req, res) => {
    try {
      // Get the current file's directory
      const currentDir = path.dirname(new URL(import.meta.url).pathname);
      const assetsDir = path.resolve(currentDir, "../public/assets");
      
      if (fs.existsSync(assetsDir)) {
        // Read the assets directory
        const files = fs.readdirSync(assetsDir);
        
        // Create a simple HTML listing of the files
        const fileLinks = files.map(file => {
          return `<li><a href="/assets/${file}">${file}</a></li>`;
        }).join('\n');
        
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Assets Directory</title>
            </head>
            <body>
              <h1>Assets Directory</h1>
              <ul>
                ${fileLinks}
              </ul>
            </body>
          </html>
        `;
        
        res.send(html);
      } else {
        console.error("Assets directory not found at", assetsDir);
        res.status(404).send("Assets directory not found");
      }
    } catch (error) {
      console.error("Error listing assets:", error);
      res.status(500).send("Error listing assets directory");
    }
  });

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
          tables: [] as Array<{ name: string; count: string | number }>
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
        
        // Extract counts and convert to strings to ensure type safety
        const catCount = categoriesCount.rows[0]?.count ? String(categoriesCount.rows[0].count) : "0";
        const medCount = mediaCount.rows[0]?.count ? String(mediaCount.rows[0].count) : "0";
        const userCount = usersCount.rows[0]?.count ? String(usersCount.rows[0].count) : "0";
        
        info.database.tables = [
          { name: 'categories', count: catCount },
          { name: 'media', count: medCount },
          { name: 'users', count: userCount }
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

  // Media file upload endpoint
  app.post("/api/upload", isAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Get file information
      const { filename, originalname, mimetype, size, path: filePath } = req.file;
      
      // Determine media type based on mimetype
      let mediaType = 'document'; // Default type
      if (mimetype.startsWith('image/')) {
        mediaType = 'image';
      } else if (mimetype.startsWith('video/')) {
        mediaType = 'video';
      } else if (mimetype.includes('presentation') || mimetype.includes('powerpoint')) {
        mediaType = 'presentation';
      }
      
      // Create a relative path to the file from media directory root
      const relativePath = filename;
      
      // Return file details for use in the next step (creating media record)
      res.status(200).json({
        filename,
        originalname,
        mimetype,
        size,
        mediaType,
        filePath: relativePath
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "File upload failed", error: String(error) });
    }
  });

  // Create media item (separate from file upload to handle validation properly)
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
  
  // Health check endpoint for Docker
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  
  // Define a route to manually handle specific asset requests
  app.get('/assets/:filename', (req, res) => {
    const filename = req.params.filename;
    const cwd = process.cwd();
    
    // Check multiple possible locations for the asset
    const possiblePaths = [
      path.join(cwd, 'dist/public/assets', filename),
      path.join(cwd, 'dist/client/assets', filename),
      path.join(cwd, 'dist/assets', filename),
      path.join(cwd, 'public/assets', filename)
    ];
    
    // Try to find the file in any of the possible locations
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          console.log(`Serving asset from: ${filePath}`);
          return res.sendFile(filePath);
        }
      } catch (err) {
        console.error(`Error checking path ${filePath}:`, err);
      }
    }
    
    // Try one last path based on import.meta (for ESM)
    try {
      const publicDir = path.join(cwd, 'public');
      const assetPath = path.join(publicDir, 'assets', filename);
      
      if (fs.existsSync(assetPath)) {
        console.log(`Serving asset from: ${assetPath}`);
        return res.sendFile(assetPath);
      }
    } catch (err) {
      console.error('Error on final path check:', err);
    }
    
    // If file wasn't found, return 404
    console.log(`Asset not found: ${filename}`);
    res.status(404).send(`Asset not found: ${filename}`);
  });
  
  // Assets directory listing endpoint for Docker
  app.get('/assets', (req, res) => {
    const assetsPath = path.resolve(process.cwd(), 'dist/public/assets');
    
    // Log the assets path for debugging
    console.log('Checking for assets in:', assetsPath);
    
    if (!fs.existsSync(assetsPath)) {
      // Try alternative path
      const altPath = path.resolve(process.cwd(), 'dist/client/assets');
      console.log('Trying alternative assets path:', altPath);
      
      if (fs.existsSync(altPath)) {
        // List and redirect to first asset found
        try {
          const files = fs.readdirSync(altPath);
          console.log('Found assets in alternative path:', files);
          
          let html = '<html><head><title>Assets Directory</title></head><body>';
          html += '<h1>Assets Directory (Alternative Path)</h1><ul>';
          
          files.forEach(file => {
            const href = `/assets/${file}`;
            html += `<li><a href="${href}">${file}</a></li>`;
          });
          
          html += '</ul></body></html>';
          return res.send(html);
        } catch (err) {
          console.error('Error reading alternative assets directory:', err);
        }
      }
      
      // List all possible locations
      interface LocationInfo {
        path: string;
        exists: boolean;
      }
      let possibleLocations: LocationInfo[] = [];
      [
        'dist/public/assets',
        'dist/client/assets',
        'dist/assets',
        'public/assets',
        'client/assets'
      ].forEach(dir => {
        const fullPath = path.resolve(process.cwd(), dir);
        const exists = fs.existsSync(fullPath);
        possibleLocations.push({ path: fullPath, exists });
      });
      
      return res.status(404).send(`
        <html>
          <head><title>Assets Not Found</title></head>
          <body>
            <h1>Assets directory not found</h1>
            <p>Could not find assets directory at: ${assetsPath}</p>
            <h2>Checked Locations:</h2>
            <pre>${JSON.stringify(possibleLocations, null, 2)}</pre>
            <h2>Current Directory Structure:</h2>
            <pre>${listDirectoryTree(process.cwd(), 3)}</pre>
          </body>
        </html>
      `);
    }
    
    try {
      const files = fs.readdirSync(assetsPath);
      console.log('Found assets:', files);
      
      let html = '<html><head><title>Assets Directory</title></head><body>';
      html += '<h1>Assets Directory</h1><ul>';
      
      files.forEach(file => {
        const href = `/assets/${file}`;
        html += `<li><a href="${href}">${file}</a></li>`;
      });
      
      html += '</ul></body></html>';
      res.send(html);
    } catch (err: any) {
      console.error('Error reading assets directory:', err);
      res.status(500).send(`Error reading assets directory: ${err.message}`);
    }
  });
  
  // Helper function to list directory structure
  function listDirectoryTree(dir: string, depth: number): string {
    if (depth <= 0) return '';
    
    let result = '';
    try {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(process.cwd(), fullPath);
        
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            result += `${relativePath}/\n`;
            if (depth > 1) {
              result += listDirectoryTree(fullPath, depth - 1)
                .split('\n')
                .map(line => line ? '  ' + line : line)
                .join('\n');
            }
          } else {
            result += `${relativePath}\n`;
          }
        } catch (err: any) {
          result += `${relativePath} [error: ${err.message}]\n`;
        }
      });
    } catch (err: any) {
      result += `Error listing directory ${dir}: ${err.message}\n`;
    }
    
    return result;
  }
  
  // Diagnostic endpoints for Docker
  app.get('/api/debug/info', (req, res) => {
    // Collect various system information
    const diagnosticInfo = {
      environment: {
        node_env: process.env.NODE_ENV,
        docker_env: process.env.DOCKER_ENV,
        port: process.env.PORT,
      },
      filesystem: {
        currentDirectory: __dirname,
        staticPublicPath: path.resolve(__dirname, '../public'),
        assetsExists: fs.existsSync(path.resolve(__dirname, '../public/assets')),
      },
      database: {
        connectionConfigured: !!process.env.DATABASE_URL,
        // Don't include the actual connection string for security
        connection_type: process.env.DOCKER_ENV ? 'standard_pg' : 'neon_serverless'
      },
      assetInfo: {}
    };
    
    // Check for asset manifest
    const manifestPath = path.resolve(__dirname, '../public/assets/manifest.json');
    if (fs.existsSync(manifestPath)) {
      try {
        diagnosticInfo.assetInfo = {
          manifestExists: true,
          manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        };
      } catch (e: any) {
        diagnosticInfo.assetInfo = { 
          manifestExists: true,
          error: `Error parsing manifest: ${e?.message || 'Unknown error'}` 
        };
      }
    } else {
      diagnosticInfo.assetInfo = { manifestExists: false };
      
      // List available assets
      const assetsDir = path.resolve(__dirname, '../public/assets');
      if (fs.existsSync(assetsDir)) {
        try {
          const files = fs.readdirSync(assetsDir);
          diagnosticInfo.assetInfo = {
            ...diagnosticInfo.assetInfo,
            availableAssets: files
          };
        } catch (e: any) {
          diagnosticInfo.assetInfo = {
            ...diagnosticInfo.assetInfo,
            error: `Error reading assets dir: ${e?.message || 'Unknown error'}`
          };
        }
      }
    }
    
    res.status(200).json(diagnosticInfo);
  });
  
  // Simple test page to verify HTML serving
  app.get('/test-page', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Trilogy Digital Media - Test Page</title>
          <style>
            body { font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            h1 { color: #333; }
            pre { background: #f5f5f5; padding: 10px; border-radius: 5px; overflow: auto; }
          </style>
        </head>
        <body>
          <h1>Trilogy Digital Media - Test Page</h1>
          <div class="card">
            <h2>Server Information</h2>
            <ul>
              <li>Node Environment: ${process.env.NODE_ENV || 'Not set'}</li>
              <li>Docker Environment: ${process.env.DOCKER_ENV ? 'Yes' : 'No'}</li>
              <li>Server Time: ${new Date().toISOString()}</li>
            </ul>
          </div>
          
          <div class="card">
            <h2>File System Check</h2>
            <ul>
              <li>Current Directory: ${__dirname}</li>
              <li>Static Path: ${path.resolve(__dirname, '../public')}</li>
              <li>Assets Directory Exists: ${fs.existsSync(path.resolve(__dirname, '../public/assets')) ? 'Yes' : 'No'}</li>
            </ul>
          </div>
          
          <div class="card">
            <h2>Test API Request</h2>
            <button id="testApi">Test API Connection</button>
            <pre id="apiResult">Click the button to test the API...</pre>
          </div>
          
          <script>
            document.getElementById('testApi').addEventListener('click', async () => {
              try {
                const response = await fetch('/api/debug/info');
                const data = await response.json();
                document.getElementById('apiResult').textContent = JSON.stringify(data, null, 2);
              } catch (error) {
                document.getElementById('apiResult').textContent = 'Error: ' + error.message;
              }
            });
          </script>
        </body>
      </html>
    `);
  });

  const httpServer = createServer(app);

  return httpServer;
}
