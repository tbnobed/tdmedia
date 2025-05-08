import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth, hashPassword, comparePasswords } from "./auth";
import { storage } from "./storage";
import { insertPlaylistSchema, insertMediaSchema, insertContactSchema, insertMediaAccessSchema, User, MediaAccess, mediaPlaylists, playlists } from "@shared/schema";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { createHmac } from "crypto";
import { sendWelcomeEmail } from "./email";
import { db, executeRawSQL } from "@db";
import { sql, InferSelectModel, eq, and } from "drizzle-orm";
import { upload, getFileTypeFromFilename, getFormattedFileSize, generateThumbnail, getVideoDuration } from './upload';
import { generateMediaAccessToken, generateStreamToken, verifyMediaAccessToken } from './token';

// Type for streaming info
interface StreamInfo {
  streamUrl: string;
}

// Helper functions for media access control
async function checkMediaAccess(userId: number, mediaId: number, isAdmin: boolean): Promise<boolean> {
  // If isAdmin flag is already set, trust it
  if (isAdmin) {
    console.log(`Admin access granted for user ${userId} (from session)`);
    return true;
  }
  
  // If session doesn't have admin status, check the database directly
  // This handles cases where the session isn't properly maintained by proxies
  try {
    const user = await storage.getUser(userId);
    if (user && user.isAdmin) {
      console.log(`Admin access granted for user ${userId} (from database lookup)`);
      return true;
    }
  } catch (error) {
    console.error(`Error checking admin status for user ${userId}:`, error);
    // Continue to check media access - don't let an error here block access
  }
  
  // Get media access for this user
  const mediaAccessList = await storage.getMediaAccessByUser(userId);
  const hasAccess = mediaAccessList.some((access: { media_id: number }) => access.media_id === mediaId);
  
  if (hasAccess) {
    console.log(`Media access granted for user ${userId} to media ${mediaId}`);
  } else {
    console.log(`Media access denied for user ${userId} to media ${mediaId}`);
  }
  
  return hasAccess;
}

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
      // Check database connection using our helper function
      await executeRawSQL("SELECT 1");
      res.status(200).json({ status: "ok", message: "Service is healthy" });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({ status: "error", message: "Service unhealthy" });
    }
  });

  // Admin middleware - Check if user is admin
  const isAdmin = (req: Request, res: Response, next: Function) => {
    // Check if request is authenticated
    if (!req.isAuthenticated()) {
      console.log('Admin access attempt without authentication');
      return res.status(401).json({ message: "Unauthorized - Please log in" });
    }
    
    // Check if authenticated user has admin privileges
    if (!req.user?.isAdmin) {
      console.log(`User ${req.user?.id} attempted admin access without permission`);
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    
    // Admin check passed
    console.log(`Admin access granted for user ${req.user.id}`);
    next();
  };

  // Auth middleware - Check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: Function) => {
    if (!req.isAuthenticated() || !req.user) {
      console.log('Access attempt without valid authentication');
      return res.status(401).json({ message: "Unauthorized - Please log in" });
    }
    
    // Authentication check passed
    next();
  };

  // Playlists endpoints
  app.get("/api/playlists", async (req, res) => {
    try {
      const playlists = await storage.getPlaylists();
      res.json(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
      res.status(500).json({ message: "Failed to fetch playlists" });
    }
  });

  app.post("/api/playlists", isAdmin, async (req, res) => {
    try {
      const validatedData = insertPlaylistSchema.parse(req.body);
      const newPlaylist = await storage.createPlaylist(validatedData);
      res.status(201).json(newPlaylist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating playlist:", error);
      res.status(500).json({ message: "Failed to create playlist" });
    }
  });

  app.put("/api/playlists/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertPlaylistSchema.parse(req.body);
      const updatedPlaylist = await storage.updatePlaylist(id, validatedData);
      
      if (!updatedPlaylist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
      
      res.json(updatedPlaylist);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating playlist:", error);
      res.status(500).json({ message: "Failed to update playlist" });
    }
  });

  app.delete("/api/playlists/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePlaylist(id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting playlist:", error);
      res.status(500).json({ message: "Failed to delete playlist" });
    }
  });

  // Get playlists for a specific media item
  app.get("/api/media/:id/playlists", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Execute raw SQL query to avoid column name issues
      const mediaPlaylistsData = await executeRawSQL(`
        SELECT 
          mp.id, 
          mp.media_id as "mediaId", 
          mp.playlist_id as "playlistId", 
          p.name as "playlistName", 
          p.description as "playlistDescription"
        FROM media_playlists mp
        INNER JOIN playlists p ON mp.playlist_id = p.id
        WHERE mp.media_id = $1
      `, [id]);
      
      res.json(mediaPlaylistsData.rows);
    } catch (error) {
      console.error("Error fetching media playlists:", error);
      res.status(500).json({ message: "Failed to fetch playlists for media" });
    }
  });

  // Media endpoints
  app.get("/api/media", isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const playlistIdParam = req.query.playlist as string | undefined;
      const sort = req.query.sort as string | undefined;
      
      console.log("GET /api/media params:", { search, playlistIdParam, sort, user: req.user?.id, isAdmin: req.user?.isAdmin });
      
      const playlistId = playlistIdParam ? parseInt(playlistIdParam) : undefined;
      
      // Only pass the userId for non-admin users to filter content
      // Admin users should see all content
      const userId = req.user!.isAdmin ? undefined : req.user!.id;
      console.log(`Fetching media for user ${req.user!.id}, isAdmin: ${req.user!.isAdmin}, filtering by userId: ${userId || 'none (admin view)'}`);
      
      try {
        const mediaItems = await storage.getMedia({ search, playlistId, sort, userId });
        console.log(`Successfully fetched ${mediaItems.length} media items`);
        res.json(mediaItems);
      } catch (queryError) {
        console.error("Database error fetching media:", queryError);
        if (queryError instanceof Error) {
          console.error("Error details:", queryError.message, queryError.stack);
        }
        throw queryError;
      }
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
      
      // Check if this is a thumbnail upload for an existing media
      const thumbnailForMediaId = req.headers['x-tbn-thumbnail-for'];
      const isThumbnailUpload = !!thumbnailForMediaId;
      
      console.log('Upload headers:', req.headers);
      console.log('Is thumbnail upload:', isThumbnailUpload);
      if (isThumbnailUpload) {
        console.log('Thumbnail for media ID:', thumbnailForMediaId);
      }
      
      // Handle different formats of the type parameter
      let fileType;
      // Force image type for thumbnails
      if (isThumbnailUpload) {
        fileType = 'image';
        console.log('Setting fileType to image for thumbnail');
      } else if (Array.isArray(req.body.type)) {
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
      // For thumbnails, always use the thumbnails directory
      if (isThumbnailUpload) {
        typeDirectory = 'thumbnails';
        console.log('Using thumbnails directory for thumbnail upload');
      } else {
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
      
      // Extract duration for video files
      let duration;
      if (fileType === 'video') {
        try {
          // Get actual duration from the video file
          duration = await getVideoDuration(file.path);
          console.log(`Extracted video duration: ${duration}`);
        } catch (err) {
          console.error("Error extracting video duration:", err);
          duration = '00:00:00'; // Fallback duration
        }
      }
      
      // If this is a thumbnail upload for a media item, update that media item's thumbnailUrl
      if (isThumbnailUpload && thumbnailForMediaId) {
        try {
          const mediaId = parseInt(thumbnailForMediaId.toString(), 10);
          if (!isNaN(mediaId)) {
            console.log(`Updating media ${mediaId} with new thumbnail URL: ${fileUrl}`);
            const mediaItem = await storage.getMediaById(mediaId);
            
            if (mediaItem) {
              // Update the media record with the new thumbnail URL
              const updatedMedia = await storage.updateMedia(mediaId, {
                ...mediaItem,
                thumbnailUrl: fileUrl
              });
              
              console.log(`Successfully updated thumbnailUrl for media ${mediaId}`);
              
              // Return thumbnail-specific response
              return res.status(201).json({
                thumbnailUrl: fileUrl,
                mediaId,
                message: "Thumbnail uploaded and media updated successfully"
              });
            } else {
              console.error(`Could not find media with ID ${mediaId} to update with new thumbnail`);
            }
          } else {
            console.error('Invalid media ID in X-TBN-Thumbnail-For header:', thumbnailForMediaId);
          }
        } catch (err) {
          console.error('Error updating media with new thumbnail:', err);
          // Continue with standard response if updating the media fails
        }
      }
      
      // Standard response for regular uploads
      const fileData = {
        fileUrl,
        thumbnailUrl,
        type: fileType,
        size: fileSize,
        duration: duration,
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
  
  // Create a new media entry with playlist associations
  app.post("/api/media", isAdmin, async (req, res) => {
    try {
      console.log("Received media creation request:", req.body);
      // Extract playlistIds before validation since it's not part of the media schema
      const { playlistIds, ...mediaData } = req.body;
      
      // Validate the media data
      const validatedMediaData = insertMediaSchema.parse(mediaData);
      console.log("Validated media data:", validatedMediaData);
      
      // Create the media entry
      const newMedia = await storage.createMedia(validatedMediaData);
      console.log("Media created successfully:", newMedia);
      
      // If playlistIds were provided, create the associations
      if (Array.isArray(playlistIds) && playlistIds.length > 0) {
        console.log(`Creating ${playlistIds.length} playlist associations for media ID ${newMedia.id}`);
        
        // Create associations in the join table
        for (const playlistId of playlistIds) {
          try {
            const parsedPlaylistId = parseInt(playlistId.toString(), 10);
            await executeRawSQL(`
              INSERT INTO media_playlists (media_id, playlist_id)
              VALUES ($1, $2)
            `, [newMedia.id, parsedPlaylistId]);
          } catch (err) {
            console.error(`Error creating media-playlist association for playlist ${playlistId}:`, err);
            // Continue with other playlists even if one fails
          }
        }
      }
      
      // Return the created media with its playlist associations
      res.status(201).json(newMedia);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation error:", error.errors);
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating media:", error);
      res.status(500).json({ message: "Failed to create media" });
    }
  });

  app.put("/api/media/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      console.log("Received PUT request for media ID:", id);
      console.log("Request body:", req.body);
      
      // Extract playlistIds before validation since it's not part of the media schema
      const { playlistIds, ...mediaData } = req.body;
      
      console.log("Extracted playlistIds:", playlistIds);
      console.log("Extracted mediaData:", mediaData);
      
      // Get existing media to preserve thumbnailUrl if not provided
      const existingMedia = await storage.getMediaById(id);
      if (!existingMedia) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // If thumbnailUrl is empty but exists in the database, keep the existing one
      if (!mediaData.thumbnailUrl && existingMedia.thumbnailUrl) {
        console.log("Preserving existing thumbnailUrl:", existingMedia.thumbnailUrl);
        mediaData.thumbnailUrl = existingMedia.thumbnailUrl;
      }
      
      // Validate the media data
      const validatedData = insertMediaSchema.parse(mediaData);
      console.log("Validated media data:", validatedData);
      
      const updatedMedia = await storage.updateMedia(id, validatedData);
      
      if (!updatedMedia) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // Update playlist associations if provided
      console.log("Received request to update media playlists:", { mediaId: id, playlistIds });
      
      if (Array.isArray(playlistIds)) {
        try {
          // First, delete existing associations
          console.log(`Deleting existing playlist associations for media ID ${id}`);
          await executeRawSQL(`
            DELETE FROM media_playlists
            WHERE media_id = $1
          `, [id]);
          console.log("Existing playlist associations deleted successfully");
          
          // Then create new associations
          if (playlistIds.length > 0) {
            console.log(`Creating ${playlistIds.length} new playlist associations`);
            for (const playlistId of playlistIds) {
              const parsedPlaylistId = parseInt(playlistId.toString(), 10);
              console.log(`Adding media ${id} to playlist ${parsedPlaylistId}`);
              await executeRawSQL(`
                INSERT INTO media_playlists (media_id, playlist_id)
                VALUES ($1, $2)
              `, [id, parsedPlaylistId]);
            }
            console.log("All playlist associations created successfully");
          } else {
            console.log("No new playlist associations to create");
          }
        } catch (err) {
          console.error(`Error updating playlist associations for media ${id}:`, err);
          // Continue even if playlist association update fails
        }
      } else {
        console.log("No playlistIds provided or not an array:", playlistIds);
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

  // Endpoint to get playlists for a specific media item
  app.get("/api/media/:id/playlists", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if media exists and user has access
      const hasAccess = await checkMediaAccess(req.user!.id, id, req.user!.isAdmin);
      if (!hasAccess) {
        return res.status(403).json({ message: "You don't have access to this media" });
      }
      
      // Get playlists for this media
      const playlistsData = await executeRawSQL(`
        SELECT mp.id, mp.media_id AS "mediaId", mp.playlist_id AS "playlistId", p.name AS "playlistName"
        FROM media_playlists mp
        JOIN playlists p ON mp.playlist_id = p.id
        WHERE mp.media_id = $1
      `, [id]);
      
      res.json(playlistsData);
    } catch (error) {
      console.error("Error fetching media playlists:", error);
      res.status(500).json({ message: "Failed to fetch media playlists" });
    }
  });

  app.delete("/api/media/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log("Deleting media with ID:", id);

      // First delete any media access entries related to this media
      try {
        await storage.removeAllMediaAccess(id);
        console.log("Removed all media access records for media ID:", id);
      } catch (accessError) {
        console.error("Error removing media access during deletion:", accessError);
        // Continue with deletion even if this fails
      }

      // Delete playlist associations
      try {
        await executeRawSQL(`
          DELETE FROM media_playlists
          WHERE media_id = $1
        `, [id]);
        console.log("Removed all playlist associations for media ID:", id);
      } catch (playlistError) {
        console.error("Error removing playlist associations during deletion:", playlistError);
        // Continue with deletion even if this fails
      }

      // Now delete the media itself
      await storage.deleteMedia(id);
      console.log("Successfully deleted media with ID:", id);
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting media:", error);
      // Log more detailed error information
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      }
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

  // Stream media with watermark using JWT for authentication
  app.get("/api/stream/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const mediaItem = await storage.getMediaById(id);
      
      if (!mediaItem) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // Check if user has access to this media
      const userId = req.user?.id || 0;
      const hasAccess = await checkMediaAccess(userId, id, !!req.user?.isAdmin);
      
      if (!hasAccess) {
        console.log(`User ${userId} attempted to access unauthorized media ${id}`);
        return res.status(403).json({ message: "You don't have access to this media" });
      }
      
      // Generate a JWT token for streaming this specific media with user info embedded
      // Make sure we have all required user properties
      const userForToken = {
        id: req.user!.id,
        username: req.user!.username,
        email: req.user!.email,
        isAdmin: !!req.user!.isAdmin,
        // Add required properties that might be undefined in req.user
        password: req.user!.password || '',
        createdAt: req.user!.createdAt || new Date()
      };
      const streamToken = generateStreamToken(userForToken, id);
      
      // Use the token in the URL for authentication - no session required
      const streamUrl = `/api/raw-stream/${id}?token=${streamToken}`;
      
      console.log(`Generated stream token for user ${userId}, media ${id}`);
      
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
  
  // Raw stream endpoint - serves the actual media file using JWT authentication
  app.get("/api/raw-stream/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { token } = req.query;
      
      // Validate the token to prevent unauthorized access
      if (!token || typeof token !== 'string') {
        console.log("Missing required token parameter");
        return res.status(401).json({ message: "Missing authentication token" });
      }
      
      // Verify the JWT token
      const decodedToken = verifyMediaAccessToken(token);
      if (!decodedToken) {
        console.log("Invalid or expired token");
        return res.status(401).json({ message: "Invalid or expired token" });
      }
      
      // Extract user info from the token
      const { userId, isAdmin, mediaId } = decodedToken;
      
      // If token contains a specific mediaId, verify it matches the requested media
      if (mediaId !== undefined && mediaId !== id) {
        console.log(`Token is for media ${mediaId} but requested ${id}`);
        return res.status(403).json({ message: "Token not valid for this media" });
      }
      
      // Get the media item
      const mediaItem = await storage.getMediaById(id);
      if (!mediaItem) {
        return res.status(404).json({ message: "Media not found" });
      }
      
      // We don't need to check session admin status anymore - the token contains this info
      console.log(`Token verification successful - User: ${userId}, Admin: ${isAdmin}, Media: ${id}`);
      
      // Double-check access rights from the database to be extra sure
      const hasAccess = await checkMediaAccess(userId, id, isAdmin);
      
      if (!hasAccess) {
        console.log(`User ${userId} attempted to access unauthorized media ${id}`);
        return res.status(403).json({ message: "You don't have access to this media" });
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
      
      // Stream the file based on media type and user role
      // Admin users get clean files, client users get watermarked content
      if (mediaItem.type === 'video') {
        // For videos, use range streaming for better playback
        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = req.headers.range;
        
        // Add custom headers to help the client player apply appropriate restrictions
        // These are read by our secure player implementations
        const customHeaders = {
          'X-TBN-Watermark': isAdmin ? 'none' : 'required',
          'X-TBN-Role': isAdmin ? 'admin' : 'client'
        };
        
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
            ...customHeaders
          });
          
          file.pipe(res);
        } else {
          res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
            ...customHeaders
          });
          
          fs.createReadStream(filePath).pipe(res);
        }
      } else if (mediaItem.type === 'image') {
        // For images, add watermarking headers for client users
        res.setHeader('Content-Type', 'image/jpeg'); // Adjust based on actual image type
        res.setHeader('X-TBN-Watermark', isAdmin ? 'none' : 'required');
        res.setHeader('X-TBN-Role', isAdmin ? 'admin' : 'client');
        
        fs.createReadStream(filePath).pipe(res);
      } else {
        // For documents and other files, add watermarking headers for client users
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
        res.setHeader('X-TBN-Watermark', isAdmin ? 'none' : 'required');
        res.setHeader('X-TBN-Role', isAdmin ? 'admin' : 'client');
        
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
      
      // Import required functions
      const { sendContactNotification } = await import('./email');
      
      // Send email notification
      try {
        const emailSent = await sendContactNotification(
          validatedData.name,
          validatedData.email,
          validatedData.company,
          validatedData.message
        );
        
        if (emailSent) {
          console.log(`Contact notification email sent successfully for contact ID: ${newContact.id}`);
        } else {
          console.warn(`Failed to send contact notification email for contact ID: ${newContact.id}`);
        }
      } catch (emailError) {
        console.error('Error sending contact notification email:', emailError);
        // Don't fail the request if email sending fails
      }
      
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

  // User Management
  
  // Get all users
  app.get("/api/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

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
  
  // Create a new admin user
  app.post("/api/users/admins", isAdmin, async (req, res) => {
    try {
      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      
      // Prepare user data with admin role
      const userData = {
        ...req.body,
        isAdmin: true
      };
      
      // Validate the data
      const validatedData = z.object({
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(6),
        isAdmin: z.boolean()
      }).parse(userData);
      
      // Hash the password before saving the user
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create the admin user with hashed password
      const newUser = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      
      res.status(201).json({
        user: userWithoutPassword
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating admin:", error);
      res.status(500).json({ 
        message: "Failed to create admin user",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete an admin user
  app.delete("/api/users/admins/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Make sure the user is actually an admin
      if (!user.isAdmin) {
        return res.status(400).json({ message: "Specified user is not an admin" });
      }
      
      // Don't allow deleting your own account
      if (req.user?.id === id) {
        return res.status(403).json({ message: "Cannot delete your own admin account" });
      }
      
      // Delete the admin user
      await storage.deleteUser(id);
      
      res.sendStatus(204); // Successful deletion (no content)
    } catch (error) {
      console.error("Error deleting admin user:", error);
      res.status(500).json({ message: "Failed to delete admin user" });
    }
  });
  
  // Update user credentials (for self-service password changes)
  app.put("/api/users/:id/credentials", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Users can only update their own credentials unless they're an admin
      if (userId !== req.user!.id && !req.user!.isAdmin) {
        return res.status(403).json({ message: "You can only update your own credentials" });
      }
      
      // Get the current user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Validate the request data
      const validatedData = z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6),
      }).parse(req.body);
      
      // Verify the current password
      const passwordValid = await comparePasswords(validatedData.currentPassword, user.password);
      if (!passwordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(validatedData.newPassword);
      
      // Update the user's password
      const updatedUser = await storage.updateUserCredentials(userId, hashedPassword);
      
      // Remove sensitive data from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating credentials:", error);
      res.status(500).json({ message: "Failed to update credentials" });
    }
  });
  
  // Create a new client user
  app.post("/api/users/clients", isAdmin, async (req, res) => {
    try {
      // Check if user with this email already exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }
      
      // Prepare user data with client role
      const userData = {
        ...req.body,
        isAdmin: false
      };
      
      // Validate the data
      const validatedData = z.object({
        username: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(6),
        isAdmin: z.boolean()
      }).parse(userData);
      
      // Hash the password before saving the user
      const hashedPassword = await hashPassword(validatedData.password);
      
      // Create the user with hashed password
      const newUser = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // If media IDs were provided, assign them to the new user
      const mediaIds = req.body.mediaIds;
      if (Array.isArray(mediaIds) && mediaIds.length > 0) {
        const adminId = req.user?.id || 0;
        
        // Assign each media to the user
        for (const mediaId of mediaIds) {
          await storage.assignMediaToUser(parseInt(mediaId), newUser.id, adminId);
        }
      }
      
      // Send welcome email if requested
      if (req.body.sendWelcomeEmail === true) {
        const success = await sendWelcomeEmail(
          newUser.email,
          newUser.username,
          req.body.password, // Using original password before it was hashed
          process.env.SENDGRID_FROM_EMAIL, // From email address
          process.env.APP_DOMAIN // Application domain for login URL
        );
        
        if (!success) {
          console.warn(`Failed to send welcome email to ${newUser.email}`);
        } else {
          console.log(`Welcome email sent to ${newUser.email}`);
        }
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      
      res.status(201).json({
        user: userWithoutPassword,
        emailSent: req.body.sendWelcomeEmail === true
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating client:", error);
      res.status(500).json({ 
        message: "Failed to create client",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Delete a client user
  app.delete("/api/users/clients/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if user exists
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't allow deletion of admin users through this endpoint
      if (user.isAdmin) {
        return res.status(403).json({ message: "Cannot delete admin users" });
      }
      
      // Delete the user (this will also remove all media access entries)
      await storage.deleteUser(id);
      
      res.sendStatus(204); // Successful deletion (no content)
    } catch (error) {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Failed to delete client" });
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
      const { media_id, user_id } = validatedData;
      
      // isAdmin middleware ensures req.user is defined
      const createdById = req.user!.id;
      
      const mediaAccess = await storage.assignMediaToUser(media_id, user_id, createdById);
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
  app.delete("/api/media-access/:media_id/:user_id", isAdmin, async (req, res) => {
    try {
      const mediaId = parseInt(req.params.media_id);
      const userId = parseInt(req.params.user_id);
      
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
      // Support both 'playlist' and 'playlistId' parameters (and legacy 'category' and 'categoryId' for backwards compatibility)
      const playlistIdParam = (req.query.playlistId || req.query.playlist || req.query.categoryId || req.query.category) as string | undefined;
      const sort = req.query.sort as string | undefined;
      
      // Log incoming parameters for debugging
      console.log("Client media request params:", {
        search,
        playlistIdParam,
        sort,
        user: req.user?.id
      });
      
      const playlistId = playlistIdParam ? parseInt(playlistIdParam) : undefined;
      
      // isAuthenticated middleware ensures req.user is defined
      const userId = req.user!.id;
      
      // Only show media items the user has access to (if not admin)
      const filters: { 
        search?: string; 
        playlistId?: number; 
        sort?: string;
        userId?: number;
      } = { search, playlistId, sort };
      
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
