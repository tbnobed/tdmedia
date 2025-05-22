import { useState } from "react";
import { Media } from "@shared/schema";
import { getMediaTypeColor } from "@/lib/media-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Mail, X } from "lucide-react";
import IframeVideoPlayer from "./iframe-video-player";
import "./media-viewer.css";

interface MediaViewerProps {
  media: Media | null;
  isOpen: boolean;
  onClose: () => void;
  onContactRequest: (media: Media) => void;
}

export default function StableMediaViewer({ media, isOpen, onClose, onContactRequest }: MediaViewerProps) {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Safety check
  if (!isOpen || !media) {
    return null;
  }
  
  // Get media type color
  const typeColor = getMediaTypeColor(media.type);
  
  // Handle contact button click
  const handleContact = () => {
    onClose();
    onContactRequest(media);
  };
  
  // Simple content type display function
  const getContentDisplay = () => {
    if (!media.contentType || media.contentType === 'other') {
      return null;
    }
    
    let displayText = '';
    
    if (media.contentType === 'film') {
      displayText = `Film${media.year ? ` (${media.year})` : ''}`;
    } else if (media.contentType === 'tv_show') {
      displayText = 'TV Show';
      if (media.seasonNumber) {
        displayText += ` • ${media.seasonNumber} Season${media.seasonNumber > 1 ? 's' : ''}`;
      }
      if (media.totalEpisodes) {
        displayText += ` • ${media.totalEpisodes} Episodes`;
      }
      if (media.year) {
        displayText += ` • ${media.year}`;
      }
    }
    
    return displayText ? (
      <div className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-1 rounded">
        {displayText}
      </div>
    ) : null;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        {/* Close button */}
        <div className="absolute right-2 top-2 z-10">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Video player */}
        <div className="bg-black aspect-video w-full">
          <IframeVideoPlayer
            mediaId={media.id}
            className="w-full h-full"
            onError={(err) => setError(err)}
            onLoad={() => setIsLoading(false)}
          />
        </div>
        
        {/* Media info */}
        <div className="p-4">
          <DialogHeader className="mb-4">
            <DialogTitle>{media.title}</DialogTitle>
            {getContentDisplay()}
            <DialogDescription>{media.description}</DialogDescription>
          </DialogHeader>
          
          <div className="flex items-center justify-between">
            <div>
              <span className={`inline-block px-2 py-1 rounded text-xs ${typeColor}`}>
                {media.type}
              </span>
            </div>
            
            <Button onClick={handleContact} variant="outline" size="sm">
              <Mail className="mr-2 h-4 w-4" />
              Contact Us
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}