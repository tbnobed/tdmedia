import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create separate folders for different media types
const docsDir = path.join(uploadsDir, 'documents');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');
const presentationsDir = path.join(uploadsDir, 'presentations');

// Ensure all subdirectories exist
[docsDir, imagesDir, videosDir, presentationsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// File filter function to check valid file types
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  const mediaType = req.body.type || req.query.type;
  
  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Define allowed extensions by media type
  const allowedExtensions: Record<string, string[]> = {
    'document': ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
    'image': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'],
    'video': ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
    'presentation': ['.ppt', '.pptx', '.key', '.odp']
  };
  
  // Check if we have a valid media type and extension
  if (mediaType && allowedExtensions[mediaType] && allowedExtensions[mediaType].includes(ext)) {
    return cb(null, true);
  }
  
  // Automatically detect type based on extension if not specified
  if (!mediaType) {
    if (allowedExtensions.document.includes(ext)) {
      req.body.type = 'document';
      return cb(null, true);
    } else if (allowedExtensions.image.includes(ext)) {
      req.body.type = 'image';
      return cb(null, true);
    } else if (allowedExtensions.video.includes(ext)) {
      req.body.type = 'video';
      return cb(null, true);
    } else if (allowedExtensions.presentation.includes(ext)) {
      req.body.type = 'presentation';
      return cb(null, true);
    }
  }
  
  // Reject file if it doesn't match any criteria
  cb(new Error('Invalid file type. Only documents, images, videos and presentations are allowed.'));
};

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mediaType = req.body.type || req.query.type;
    let uploadPath = uploadsDir;
    
    // Set destination based on media type
    switch (mediaType) {
      case 'document':
        uploadPath = docsDir;
        break;
      case 'image':
        uploadPath = imagesDir;
        break;
      case 'video':
        uploadPath = videosDir;
        break;
      case 'presentation':
        uploadPath = presentationsDir;
        break;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent overwrites
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname);
    cb(null, `file-${uniqueSuffix}${ext}`);
  }
});

// Set up the multer upload middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  }
});

// Helper function to get file type from filename
export function getFileTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  // Check extension against our allowed lists
  if (['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(ext)) {
    return 'document';
  } else if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(ext)) {
    return 'image';
  } else if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) {
    return 'video';
  } else if (['.ppt', '.pptx', '.key', '.odp'].includes(ext)) {
    return 'presentation';
  }
  
  // Default fallback
  return 'document';
}

// Helper function to get file size in a readable format
export function getFormattedFileSize(filePath: string): string {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats.size;
  const fileSizeInKB = fileSizeInBytes / 1024;
  
  if (fileSizeInKB < 1024) {
    return `${Math.round(fileSizeInKB * 10) / 10} KB`;
  } else {
    const fileSizeInMB = fileSizeInKB / 1024;
    return `${Math.round(fileSizeInMB * 10) / 10} MB`;
  }
}

// Helper function to extract duration from video file (placeholder)
export function getVideoDuration(filePath: string): Promise<string> {
  // In a real implementation, you would use ffmpeg or a similar library
  // to get the actual duration of video files
  // For now, we'll just return a placeholder
  return Promise.resolve('00:00:00');
}