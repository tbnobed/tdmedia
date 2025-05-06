import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

// Ensure all subdirectories exist
[docsDir, imagesDir, videosDir, presentationsDir, thumbnailsDir].forEach(dir => {
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

// Helper function to extract duration from video file using ffmpeg
export async function getVideoDuration(filePath: string): Promise<string> {
  try {
    // Use ffmpeg to get the duration of the video
    // The command format returns the duration in seconds
    const ffmpegCommand = `ffmpeg -i "${filePath}" 2>&1 | grep "Duration" | cut -d ' ' -f 4 | sed s/,//`;
    
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    
    if (stderr && !stdout) {
      console.error('Error getting video duration:', stderr);
      return '00:00:00';
    }
    
    // Parse the duration from the output (format: HH:MM:SS.MS)
    const durationStr = stdout.trim();
    
    // If we have a valid duration string, return it (removing milliseconds if present)
    if (durationStr && durationStr.includes(':')) {
      return durationStr.split('.')[0]; // Remove milliseconds
    }
    
    return '00:00:00';
  } catch (error) {
    console.error('Error extracting video duration:', error);
    return '00:00:00';
  }
}

// Helper function to generate a thumbnail for a video
export async function generateThumbnail(videoId: number, videoFilePath: string): Promise<{ success: boolean, thumbnailPath?: string, error?: string }> {
  try {
    // Create a unique filename for the thumbnail
    const thumbnailFilename = `thumbnail-${videoId}-${Date.now()}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    
    // Use ffmpeg to extract a frame from the video at 1 second (adjust timing as needed)
    // This will use I-frames at time position 00:00:01 for better quality
    const ffmpegCommand = `ffmpeg -i "${videoFilePath}" -ss 00:00:01 -vframes 1 -q:v 2 "${thumbnailPath}"`;
    
    try {
      // Execute the ffmpeg command to generate the thumbnail
      await execAsync(ffmpegCommand);
      
      // Check if the file was actually created
      if (!fs.existsSync(thumbnailPath)) {
        throw new Error('Thumbnail file was not created by ffmpeg');
      }
      
      // Calculate relative path for the database
      const relativeThumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
      
      return {
        success: true,
        thumbnailPath: relativeThumbnailPath
      };
    } catch (execError) {
      console.error('FFmpeg error:', execError);
      
      // Fallback to a simple SVG placeholder if ffmpeg fails
      const placeholderSvg = `
        <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1e293b"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
            Video #${videoId} Thumbnail
          </text>
          <circle cx="320" cy="180" r="60" fill="none" stroke="white" stroke-width="4"/>
          <polygon points="310,150 310,210 360,180" fill="white"/>
        </svg>
      `;
      
      // Write the SVG to a file
      fs.writeFileSync(thumbnailPath, placeholderSvg);
      
      // Calculate relative path for the database
      const relativeThumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
      
      return {
        success: true,
        thumbnailPath: relativeThumbnailPath
      };
    }
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating thumbnail'
    };
  }
}