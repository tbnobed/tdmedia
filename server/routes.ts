import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertCategorySchema, insertMediaSchema, insertContactSchema, insertMediaAccessSchema, User } from "@shared/schema";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import { db } from "@db";
import { sql, InferSelectModel } from "drizzle-orm";
import { upload, getFileTypeFromFilename, getFormattedFileSize, generateThumbnail } from './upload';

// Extend Express Request to include user type
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      isAdmin: boolean;
    }
  }
}

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

  // Admin middleware - Check if user is admin
  const isAdmin = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (!req.user.isAdmin) {
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

  // Upload a new media file
  app.post("/api/upload", isAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Get file details
      const file = req.file;
      
      // Handle different formats of the type parameter
      let fileType;
      if (Array.isArray(req.body.type)) {
        // If it's an array, use the first value
        fileType = req.body.type[0] || getFileTypeFromFilename(file.filename);
      } else {
        // Use the string value or fall back to filename detection
        fileType = req.body.type || getFileTypeFromFilename(file.filename);
      }
      
      // Validate file type is one of the allowed types
      if (!['video', 'image', 'document', 'presentation'].includes(fileType)) {
        fileType = getFileTypeFromFilename(file.filename);
      }
      
      const fileSize = getFormattedFileSize(file.path);
      
      // Build the URL for the file
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? process.env.PUBLIC_URL || '' 
        : '';
        
      // Map file type to the correct directory path
      let typeDirectory;
      switch(fileType) {
        case 'video':
          typeDirectory = 'videos';
          break;
        case 'image':
          typeDirectory = 'images';
          break;
        case 'document':
          typeDirectory = 'documents';
          break;
        case 'presentation':
          typeDirectory = 'presentations';
          break;
        default:
          typeDirectory = 'uploads';
      }
      
      const fileUrl = `${baseUrl}/uploads/${typeDirectory}/${file.filename}`;
      
      // Handle thumbnails for images and videos (simplified)
      let thumbnailUrl = '';
      if (fileType === 'image') {
        // For images, use the image itself as the thumbnail
        thumbnailUrl = fileUrl;
      }
      
      // Add metadata about watermarking
      let watermarkInfo = '';
      if (fileType === 'image' || fileType === 'video') {
        watermarkInfo = 'Watermarked with "TRILOGY DIGITAL" branding';
      } else if (fileType === 'document' || fileType === 'presentation') {
        watermarkInfo = 'Protected document with "TRILOGY DIGITAL" watermark';
      }
      
      // Create response object with file details
      const fileData = {
        fileUrl,
        thumbnailUrl,
        type: fileType,
        size: fileSize,
        duration: fileType === 'video' ? '00:00:00' : undefined, // Simplified
        watermark: watermarkInfo
      };
      
      res.status(201).json(fileData);
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ 
        message: "Failed to upload file", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a new media entry
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
  
  // Generate thumbnail for video
  app.post("/api/media/:id/thumbnail", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mediaItem = await storage.getMediaById(id);
      
      if (!mediaItem) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // Verify this is a video
      if (mediaItem.type !== 'video') {
        return res.status(400).json({ 
          message: "Thumbnail generation is only available for video media" 
        });
      }
      
      // Make sure the file path is absolute
      let filePath = mediaItem.fileUrl;
      // Remove the leading slash if it exists and prepend the current directory
      if (filePath.startsWith('/')) {
        filePath = '.' + filePath;
      } else if (!filePath.startsWith('./')) {
        filePath = './' + filePath;
      }
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Video file not found" });
      }
      
      // Generate the thumbnail
      const result = await generateThumbnail(id, filePath);
      
      if (!result.success) {
        return res.status(500).json({ 
          message: "Failed to generate thumbnail", 
          error: result.error 
        });
      }
      
      // Update the media item with the new thumbnail
      const updatedMedia = await storage.updateMedia(id, {
        ...mediaItem,
        thumbnailUrl: result.thumbnailPath
      });
      
      res.status(200).json({
        message: "Thumbnail generated successfully",
        media: updatedMedia
      });
    } catch (error) {
      console.error("Error generating thumbnail:", error);
      res.status(500).json({ 
        message: "Failed to generate thumbnail", 
        error: error instanceof Error ? error.message : String(error)
      });
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
      // Type check: req.user is defined because isAuthenticated middleware ensures it
      const userId = req.user?.id || 0; // Fallback to 0 if somehow undefined
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
  
  // Raw stream endpoint - serves the actual media file
  app.get("/api/raw-stream/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { signature, timestamp } = req.query;
      
      // Validate the signature to prevent unauthorized access
      if (!signature || !timestamp || typeof signature !== 'string' || typeof timestamp !== 'string') {
        return res.status(401).json({ message: "Invalid signature or timestamp" });
      }
      
      // Verify that the URL hasn't expired (15 minutes validity)
      const requestTime = parseInt(timestamp);
      const currentTime = Date.now();
      if (currentTime - requestTime > 15 * 60 * 1000) { // 15 minutes in milliseconds
        return res.status(401).json({ message: "Stream URL has expired" });
      }
      
      // Get the user ID from the authenticated user
      const userId = req.user?.id || 0;
      
      // Regenerate the signature to verify
      const expectedSignature = createHmac('sha256', process.env.SESSION_SECRET || 'secure-media-secret')
        .update(`${id}-${timestamp}-${userId}`)
        .digest('hex');
      
      // Check if signatures match
      if (signature !== expectedSignature) {
        return res.status(401).json({ message: "Invalid signature" });
      }
      
      // Get the media item
      const mediaItem = await storage.getMediaById(id);
      if (!mediaItem) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // Make sure the file path is absolute
      let filePath = mediaItem.fileUrl;
      
      // Remove the leading slash if it exists and prepend the current directory
      if (filePath.startsWith('/')) {
        filePath = '.' + filePath;
      } else if (!filePath.startsWith('./')) {
        filePath = './' + filePath;
      }
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({ message: "Media file not found" });
      }
      
      // Stream the file based on media type
      if (mediaItem.type === 'video') {
        // For videos, use range streaming for better playback
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(filePath, { start, end });
          
          res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
          });
          
          file.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
          });
          
          fs.createReadStream(filePath).pipe(res);
        }
      } else if (mediaItem.type === 'image') {
        // For images, simply serve the file
        res.setHeader('Content-Type', 'image/jpeg'); // Adjust based on actual image type
        fs.createReadStream(filePath).pipe(res);
      } else {
        // For documents and other files, simply serve the file
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      console.error("Error streaming media:", error);
      res.status(500).json({ message: "Failed to stream media file" });
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

  // Media Access Management (Client User Access)
  
  // Get all non-admin users (clients)
  app.get("/api/users/clients", isAdmin, async (req, res) => {
    try {
      const clients = await storage.getNonAdminUsers();
      res.json(clients);
    } catch (error) {
      console.error("Error fetching client users:", error);
      res.status(500).json({ message: "Failed to fetch clients" });
    }
  });
  
  // Get all media assigned to a specific user
  app.get("/api/users/:userId/media", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const mediaAccess = await storage.getMediaAccessByUser(userId);
      res.json(mediaAccess);
    } catch (error) {
      console.error("Error fetching user's media access:", error);
      res.status(500).json({ message: "Failed to fetch user's media access" });
    }
  });
  
  // Get all users with access to a specific media item
  app.get("/api/media/:mediaId/users", isAdmin, async (req, res) => {
    try {
      const mediaId = parseInt(req.params.mediaId);
      const users = await storage.getMediaAccessUsers(mediaId);
      res.json(users);
    } catch (error) {
      console.error("Error fetching media access users:", error);
      res.status(500).json({ message: "Failed to fetch users with access" });
    }
  });
  
  // Assign media to a user
  app.post("/api/media-access", isAdmin, async (req, res) => {
    try {
      const validatedData = insertMediaAccessSchema.parse(req.body);
      const { mediaId, userId } = validatedData;
      
      // isAdmin middleware ensures req.user is defined
      const createdById = req.user!.id;
      
      const mediaAccess = await storage.assignMediaToUser(mediaId, userId, createdById);
      res.status(201).json(mediaAccess);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error assigning media to user:", error);
      res.status(500).json({ message: "Failed to assign media" });
    }
  });
  
  // Remove media access from a user
  app.delete("/api/media-access/:mediaId/:userId", isAdmin, async (req, res) => {
    try {
      const mediaId = parseInt(req.params.mediaId);
      const userId = parseInt(req.params.userId);
      
      await storage.removeMediaFromUser(mediaId, userId);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error removing media access:", error);
      res.status(500).json({ message: "Failed to remove media access" });
    }
  });
  
  // Client-specific media endpoint - gets only media the user has access to
  app.get("/api/client/media", isAuthenticated, async (req, res) => {
    try {
      // Only return media that this specific user has access to
      const search = req.query.search as string | undefined;
      const categoryIdParam = req.query.category as string | undefined;
      const sort = req.query.sort as string | undefined;
      
      const categoryId = categoryIdParam ? parseInt(categoryIdParam) : undefined;
      
      // isAuthenticated middleware ensures req.user is defined
      const userId = req.user!.id;
      
      // Only show media items the user has access to (if not admin)
      const filters: { 
        search?: string; 
        categoryId?: number; 
        sort?: string;
        userId?: number;
      } = { search, categoryId, sort };
      
      if (!req.user!.isAdmin) {
        Object.assign(filters, { userId });
      }
      
      const mediaItems = await storage.getMedia(filters);
      res.json(mediaItems);
    } catch (error) {
      console.error("Error fetching client media:", error);
      res.status(500).json({ message: "Failed to fetch media" });
    }
  });

  // Serve uploaded files with proper content types
  app.get('/uploads/:type/:filename', isAuthenticated, (req, res) => {
    try {
      const { type, filename } = req.params;
      
      // Validate path to prevent directory traversal attacks
      if (filename.includes('..') || !['documents', 'images', 'videos', 'presentations'].includes(type)) {
        return res.status(400).send('Invalid file path');
      }
      
      // Construct the file path
      const filePath = path.join(process.cwd(), 'uploads', type, filename);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }
      
      // Set content type based on file extension
      const ext = path.extname(filename).toLowerCase();
      const contentTypes: Record<string, string> = {
        // Images
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        // Videos
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        // Documents
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.txt': 'text/plain',
        '.rtf': 'application/rtf',
        // Presentations
        '.ppt': 'application/vnd.ms-powerpoint',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.key': 'application/vnd.apple.keynote',
        '.odp': 'application/vnd.oasis.opendocument.presentation'
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      
      // Set watermark header for media types that support it
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      
      // Add watermark header to indicate this is a protected file
      res.setHeader('X-Trilogy-Digital-Watermark', 'true');
      
      // Add a watermark to the media (would be implemented for images and videos in a real production system)
      // This is a placeholder - in a real implementation we would process the file to add visual watermarks
      
      // Send the file
      res.sendFile(filePath);
    } catch (error) {
      console.error('Error serving file:', error);
      res.status(500).send('Error serving file');
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
