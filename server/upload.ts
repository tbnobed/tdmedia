import { Request } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Determine the base directory for uploads based on environment
let uploadsDir = path.join(process.cwd(), 'uploads');

// Check if we're in a restricted filesystem environment (set in docker-entrypoint.sh)
const isRestrictedFilesystem = process.env.RESTRICTED_FILESYSTEM === 'true';
if (isRestrictedFilesystem) {
  console.log('Running in a restricted filesystem environment, using /tmp/uploads as fallback');
  uploadsDir = '/tmp/uploads';
}

// Create uploads directory if it doesn't exist
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  console.error(`Failed to create uploads directory: ${error}`);
  
  // If we're not already using the fallback and we encountered an error, switch to fallback
  if (uploadsDir !== '/tmp/uploads') {
    console.log('Falling back to /tmp/uploads directory');
    uploadsDir = '/tmp/uploads';
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }
}

// Create separate folders for different media types
const docsDir = path.join(uploadsDir, 'documents');
const imagesDir = path.join(uploadsDir, 'images');
const videosDir = path.join(uploadsDir, 'videos');
const presentationsDir = path.join(uploadsDir, 'presentations');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

// Ensure all subdirectories exist, with error handling
[docsDir, imagesDir, videosDir, presentationsDir, thumbnailsDir].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (error) {
    console.error(`Failed to create directory ${dir}: ${error}`);
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
  cb(new Error('Invalid file type. Only documents, images, videos, and presentations are allowed.'));
};

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Check if this is a thumbnail upload by examining headers
    const isThumbnailUpload = !!req.headers['x-tbn-thumbnail-for'];
    
    if (isThumbnailUpload) {
      console.log('Detected thumbnail upload via header, directing to thumbnails directory');
      cb(null, thumbnailsDir);
      return;
    }
    
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
    
    // Check if this is a thumbnail upload
    const isThumbnailUpload = !!req.headers['x-tbn-thumbnail-for'];
    const mediaId = req.headers['x-tbn-thumbnail-for'];
    
    if (isThumbnailUpload && mediaId) {
      // For thumbnails, use a prefix that includes the media ID
      cb(null, `thumbnail-${mediaId}-${uniqueSuffix}${ext}`);
    } else {
      // For regular files, use the standard naming pattern
      cb(null, `file-${uniqueSuffix}${ext}`);
    }
  }
});

// Set up the multer upload middleware
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB max file size
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

// Helper function to extract duration from media file (video or audio) using ffmpeg
export async function getVideoDuration(filePath: string): Promise<string> {
  try {
    // Use ffmpeg to get the duration of the media file
    // This works for both video and audio files
    // The command format returns the duration in seconds
    const ffmpegCommand = `ffmpeg -i "${filePath}" 2>&1 | grep "Duration" | cut -d ' ' -f 4 | sed s/,//`;
    
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    
    if (stderr && !stdout) {
      console.error('Error getting media duration:', stderr);
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
    console.error('Error extracting media duration:', error);
    return '00:00:00';
  }
}

// Helper function to generate a thumbnail for a media item (video or audio)
export async function generateThumbnail(mediaId: number, mediaFilePath: string): Promise<{ success: boolean, thumbnailPath?: string, error?: string }> {
  // Determine the media type from the file path
  const fileExt = path.extname(mediaFilePath).toLowerCase();
  const isAudio = ['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'].includes(fileExt);
  
  if (isAudio) {
    return generateAudioThumbnail(mediaId);
  }
  try {
    // Check if there are any existing thumbnails for this video ID and delete them
    try {
      // Read the thumbnails directory
      const files = fs.readdirSync(thumbnailsDir);
      
      // Filter for files that might be thumbnails for this media item
      const existingThumbnails = files.filter(file => 
        file.startsWith(`thumbnail-${mediaId}-`) || 
        file.includes(`-${mediaId}-`)
      );
      
      // Delete any existing thumbnails for this media item
      if (existingThumbnails.length > 0) {
        console.log(`Found ${existingThumbnails.length} existing thumbnails for media ${mediaId}`);
        for (const file of existingThumbnails) {
          try {
            const fullPath = path.join(thumbnailsDir, file);
            fs.unlinkSync(fullPath);
            console.log(`Deleted old thumbnail: ${fullPath}`);
          } catch (deleteErr) {
            console.error(`Failed to delete thumbnail ${file}:`, deleteErr);
            // Continue with other files even if one fails
          }
        }
      }
    } catch (err) {
      console.error(`Error checking for existing thumbnails:`, err);
      // Continue even if this fails
    }
    
    // Create a unique filename for the thumbnail
    const thumbnailFilename = `thumbnail-${mediaId}-${Date.now()}.jpg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    
    // Try a better timestamp for thumbnail - about 5% into the video to avoid black frames
    const ffmpegCommand = `ffmpeg -i "${mediaFilePath}" -ss 00:00:03 -vframes 1 -q:v 1 -f image2 "${thumbnailPath}"`;
    console.log('Running ffmpeg command:', ffmpegCommand);
    
    try {
      // Execute the ffmpeg command to generate the thumbnail
      const { stdout, stderr } = await execAsync(ffmpegCommand);
      if (stderr) {
        console.log('FFmpeg stderr:', stderr);
      }
      
      // Check if the file was actually created
      if (!fs.existsSync(thumbnailPath)) {
        throw new Error('Thumbnail file was not created by ffmpeg');
      }
      
      // Get file stats to verify the thumbnail
      const stats = fs.statSync(thumbnailPath);
      console.log(`Thumbnail created: ${thumbnailPath}, size: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error('Thumbnail file is empty');
      }
      
      // Calculate relative path for the database - this should be accessible via static middleware
      const relativeThumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
      console.log('Thumbnail URL path:', relativeThumbnailPath);
      
      return {
        success: true,
        thumbnailPath: relativeThumbnailPath
      };
    } catch (execError) {
      console.error('FFmpeg error:', execError);
      
      // Try a different timestamp as a fallback (10% into the video)
      try {
        const fallbackCommand = `ffmpeg -i "${mediaFilePath}" -ss 00:00:05 -vframes 1 -q:v 2 "${thumbnailPath}"`;
        console.log('Trying fallback ffmpeg command:', fallbackCommand);
        await execAsync(fallbackCommand);
        
        if (fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).size > 0) {
          const relativeThumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
          console.log('Fallback thumbnail created at:', relativeThumbnailPath);
          return {
            success: true,
            thumbnailPath: relativeThumbnailPath
          };
        }
      } catch (fallbackError) {
        console.error('Fallback thumbnail generation failed:', fallbackError);
      }
      
      // If all ffmpeg attempts fail, create a SVG placeholder
      const placeholderSvg = `
        <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#1e293b"/>
          <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
            Video #${mediaId} Thumbnail
          </text>
          <circle cx="320" cy="180" r="60" fill="none" stroke="white" stroke-width="4"/>
          <polygon points="310,150 310,210 360,180" fill="white"/>
        </svg>
      `;
      
      // Write the SVG to a file
      fs.writeFileSync(thumbnailPath, placeholderSvg);
      console.log('Created SVG placeholder thumbnail');
      
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

// Helper function to generate a thumbnail for an audio file
export async function generateAudioThumbnail(mediaId: number): Promise<{ success: boolean, thumbnailPath?: string, error?: string }> {
  try {
    // Check if there are any existing thumbnails for this media ID and delete them
    try {
      // Read the thumbnails directory
      const files = fs.readdirSync(thumbnailsDir);
      
      // Filter for files that might be thumbnails for this media item
      const existingThumbnails = files.filter(file => 
        file.startsWith(`thumbnail-${mediaId}-`) || 
        file.includes(`-${mediaId}-`)
      );
      
      // Delete any existing thumbnails for this media item
      if (existingThumbnails.length > 0) {
        console.log(`Found ${existingThumbnails.length} existing thumbnails for audio ${mediaId}`);
        for (const file of existingThumbnails) {
          try {
            const fullPath = path.join(thumbnailsDir, file);
            fs.unlinkSync(fullPath);
            console.log(`Deleted old thumbnail: ${fullPath}`);
          } catch (deleteErr) {
            console.error(`Failed to delete thumbnail ${file}:`, deleteErr);
            // Continue with other files even if one fails
          }
        }
      }
    } catch (err) {
      console.error(`Error checking for existing thumbnails:`, err);
      // Continue even if this fails
    }
    
    // Create a unique filename for the thumbnail
    const thumbnailFilename = `thumbnail-${mediaId}-${Date.now()}.svg`;
    const thumbnailPath = path.join(thumbnailsDir, thumbnailFilename);
    
    // Create an SVG thumbnail for audio file
    const audioSvg = `
      <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#1e293b"/>
        <text x="50%" y="40%" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
          Audio #${mediaId}
        </text>
        <!-- Audio wave visualization -->
        <g transform="translate(160, 180)">
          <rect x="0" y="0" width="20" height="40" fill="white">
            <animate attributeName="height" values="40;20;40" dur="1s" repeatCount="indefinite" />
          </rect>
          <rect x="30" y="0" width="20" height="60" fill="white">
            <animate attributeName="height" values="60;10;60" dur="0.8s" repeatCount="indefinite" />
          </rect>
          <rect x="60" y="0" width="20" height="30" fill="white">
            <animate attributeName="height" values="30;70;30" dur="0.6s" repeatCount="indefinite" />
          </rect>
          <rect x="90" y="0" width="20" height="80" fill="white">
            <animate attributeName="height" values="80;20;80" dur="0.7s" repeatCount="indefinite" />
          </rect>
          <rect x="120" y="0" width="20" height="40" fill="white">
            <animate attributeName="height" values="40;60;40" dur="0.9s" repeatCount="indefinite" />
          </rect>
          <rect x="150" y="0" width="20" height="50" fill="white">
            <animate attributeName="height" values="50;30;50" dur="1.1s" repeatCount="indefinite" />
          </rect>
          <rect x="180" y="0" width="20" height="60" fill="white">
            <animate attributeName="height" values="60;40;60" dur="0.85s" repeatCount="indefinite" />
          </rect>
          <rect x="210" y="0" width="20" height="30" fill="white">
            <animate attributeName="height" values="30;60;30" dur="0.95s" repeatCount="indefinite" />
          </rect>
          <rect x="240" y="0" width="20" height="50" fill="white">
            <animate attributeName="height" values="50;20;50" dur="0.75s" repeatCount="indefinite" />
          </rect>
          <rect x="270" y="0" width="20" height="40" fill="white">
            <animate attributeName="height" values="40;70;40" dur="1.05s" repeatCount="indefinite" />
          </rect>
        </g>
      </svg>
    `;
    
    // Write the SVG to a file
    fs.writeFileSync(thumbnailPath, audioSvg);
    console.log('Created audio SVG thumbnail');
    
    // Calculate relative path for the database
    const relativeThumbnailPath = `/uploads/thumbnails/${thumbnailFilename}`;
    
    return {
      success: true,
      thumbnailPath: relativeThumbnailPath
    };
  } catch (error) {
    console.error('Error generating audio thumbnail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error generating audio thumbnail'
    };
  }
}