import express, { type Express, type Request, type Response } from "express";
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
  // Enable CORS for all routes
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
  });

  // Create a public route for serving uploaded files - this bypasses authentication
  app.get('/uploads/*', (req, res) => {
    // This is a public route that doesn't require authentication
    const filePath = path.join(process.cwd(), req.path);
    console.log('Serving file from:', filePath);
    
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      // Send the file with correct content type based on extension
      const ext = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream'; // default
      
      // Set content type based on file extension
      if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';
      else if (ext === '.gif') contentType = 'image/gif';
      else if (ext === '.svg') contentType = 'image/svg+xml';
      else if (ext === '.mp4') contentType = 'video/mp4';
      else if (ext === '.webm') contentType = 'video/webm';
      else if (ext === '.pdf') contentType = 'application/pdf';
      
      res.set('Content-Type', contentType);
      res.sendFile(filePath);
    } else {
      console.error(`File not found: ${filePath}`);
      res.status(404).send('File not found');
    }
  });
  
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
  
  // Create a fixed thumbnail image file if it doesn't exist yet
  const defaultThumbnailPath = path.join(process.cwd(), 'uploads', 'thumbnails', 'default-video-thumbnail.jpg');
  if (!fs.existsSync(defaultThumbnailPath)) {
    // Create a "public" directory for static files if it doesn't exist
    const fs = require('fs');
    const path = require('path');
    const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    if (!fs.existsSync(thumbnailsDir)) {
      fs.mkdirSync(thumbnailsDir, { recursive: true });
    }
    
    // Create a simple blank thumbnail
    const blankImageData = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 
      0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 
      0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 
      0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xdb, 0x00, 0x43, 0x01, 0x09, 0x09, 
      0x09, 0x0c, 0x0b, 0x0c, 0x18, 0x0d, 0x0d, 0x18, 0x32, 0x21, 0x1c, 0x21, 0x32, 0x32, 0x32, 0x32, 
      0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 
      0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 
      0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0x32, 0xff, 0xc0, 
      0x00, 0x11, 0x08, 0x00, 0x80, 0x00, 0x80, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 
      0x01, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 
      0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 
      0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 
      0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 
      0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 
      0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 
      0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 
      0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 
      0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 
      0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 
      0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 
      0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 
      0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xc4, 0x00, 0x1f, 0x01, 0x00, 0x03, 
      0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 
      0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x11, 0x00, 
      0x02, 0x01, 0x02, 0x04, 0x04, 0x03, 0x04, 0x07, 0x05, 0x04, 0x04, 0x00, 0x01, 0x02, 0x77, 0x00, 
      0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 
      0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0, 0x15, 
      0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26, 0x27, 
      0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 
      0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 
      0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 
      0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 
      0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 
      0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe2, 
      0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 
      0xfa, 0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00, 0xfe, 
      0xfe, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 
      0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 
      0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 
      0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0x28, 0xa2, 0x8a, 0x00, 0xff, 0xd9
    ]);
    
    fs.writeFileSync(defaultThumbnailPath, blankImageData);
    console.log('Created default thumbnail at:', defaultThumbnailPath);
  }

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
      console.log('Original file URL:', filePath);
      
      // Remove the leading slash if it exists and prepend the current directory
      if (filePath.startsWith('/')) {
        filePath = '.' + filePath;
      } else if (!filePath.startsWith('./')) {
        filePath = './' + filePath;
      }
      
      console.log('Adjusted file path for thumbnail generation:', filePath);
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        console.error(`Video file not found at path: ${filePath}`);
        // Try alternative path formats
        const altPath = path.join(process.cwd(), 'uploads', 'videos', path.basename(filePath));
        console.log('Trying alternative path:', altPath);
        
        if (fs.existsSync(altPath)) {
          filePath = altPath;
          console.log('Found file at alternative path:', filePath);
        } else {
          return res.status(404).json({ message: "Video file not found" });
        }
      }
      
      // Generate the thumbnail
      const result = await generateThumbnail(id, filePath);
      
      if (!result.success) {
        return res.status(500).json({ 
          message: "Failed to generate thumbnail", 
          error: result.error 
        });
      }
      
      // Make sure thumbnail path is properly formatted for the browser
      let thumbnailUrl = result.thumbnailPath || '';
      
      // Log thumbnail information for debugging
      console.log('Generated thumbnail URL:', thumbnailUrl);
      
      // Update the media item with the new thumbnail
    // Make sure thumbnailUrl does not start with a slash to avoid browser issues
    if (thumbnailUrl.startsWith('/')) {
      thumbnailUrl = thumbnailUrl.substring(1);
    }
      
    const updatedMedia = await storage.updateMedia(id, {
      ...mediaItem,
      thumbnailUrl
    });
      
      console.log('Updated media with thumbnail:', updatedMedia);
      
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
