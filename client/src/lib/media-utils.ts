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
        bg: 'bg-gray-900',
        text: 'text-blue-300'
      };
    case 'document':
      return {
        bg: 'bg-gray-900',
        text: 'text-red-300'
      };
    case 'image':
      return {
        bg: 'bg-gray-900',
        text: 'text-gray-300'
      };
    case 'presentation':
      return {
        bg: 'bg-gray-900',
        text: 'text-purple-300'
      };
    default:
      return {
        bg: 'bg-gray-900',
        text: 'text-gray-300'
      };
  }
}

// Function to get the appropriate metadata display for a media item
export function getMediaMetadata(media: Media): string {
  // Start with duration or size info
  let metadata = '';
  if (media.duration) {
    metadata = media.duration;
  } else if (media.size) {
    metadata = media.size;
  }
  
  return metadata;
}

// Function to get content classification information
export function getContentClassification(media: Media): string {
  // If no content type is provided or it's set to "other", return empty string
  if (!media.contentType || media.contentType === 'other') {
    return '';
  }
  
  // For films, show year if available
  if (media.contentType === 'film') {
    return media.year ? `Film (${media.year})` : 'Film';
  }
  
  // For TV shows, include season, episode count, and year info
  if (media.contentType === 'tv_show') {
    let info = 'TV Show';
    if (media.seasonNumber) {
      info += ` • ${media.seasonNumber} Season${media.seasonNumber > 1 ? 's' : ''}`;
    }
    if (media.totalEpisodes) {
      info += ` • ${media.totalEpisodes} Episodes`;
    }
    if (media.year) {
      info += ` • ${media.year}`;
    }
    return info;
  }
  
  // Default case for any other content type
  return 'Other Content';
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
