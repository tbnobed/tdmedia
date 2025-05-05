import { Media } from "@shared/schema";

// Function to get appropriate icon based on media type
export function getMediaTypeIcon(type: string): string {
  switch (type) {
    case 'video':
      return 'play-circle';
    case 'document':
      return 'file-text';
    case 'image':
      return 'image';
    case 'presentation':
      return 'presentation';
    default:
      return 'file';
  }
}

// Function to get color scheme based on media type
export function getMediaTypeColor(type: string): {
  bg: string;
  text: string;
} {
  switch (type) {
    case 'video':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-800'
      };
    case 'document':
      return {
        bg: 'bg-red-100',
        text: 'text-red-800'
      };
    case 'image':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800'
      };
    case 'presentation':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-800'
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800'
      };
  }
}

// Function to get the appropriate metadata display for a media item
export function getMediaMetadata(media: Media): string {
  if (media.duration) {
    return media.duration;
  }
  
  if (media.size) {
    return media.size;
  }
  
  return '';
}

// Function to get the appropriate action button text based on media type
export function getMediaActionText(type: string): string {
  switch (type) {
    case 'video':
      return 'Play';
    case 'document':
    case 'image':
    case 'presentation':
      return 'View';
    default:
      return 'Open';
  }
}

// Function to get the appropriate action button icon based on media type
export function getMediaActionIcon(type: string): string {
  switch (type) {
    case 'video':
      return 'play';
    case 'document':
    case 'image':
    case 'presentation':
      return 'eye';
    default:
      return 'arrow-right';
  }
}
