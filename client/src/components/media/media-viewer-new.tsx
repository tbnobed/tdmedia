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

export default function MediaViewerNew({ media, isOpen, onClose, onContactRequest }: MediaViewerProps) {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Safety check
  if (!isOpen || !media) {
    return null;
  }
  
  // Get badge color
  const typeColor = getMediaTypeColor(media.type);
  
  // Handlers
  const handleContactClick = () => {
    onClose();
    onContactRequest(media);
  };
  
  const handleVideoError = (err: Error) => {
    console.error("Video player error:", err);
    setError(err);
  };
  
  const handleVideoLoad = () => {
    setIsLoading(false);
  };
  
  // Content badge - inline function to avoid external dependency
  const getContentBadge = () => {
    if (!media.contentType || media.contentType === 'other') {
      return null;
    }
    
    if (media.contentType === 'film') {
      return (
        <div className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-1 rounded">
          Film{media.year ? ` (${media.year})` : ''}
        </div>
      );
    }
    
    if (media.contentType === 'tv_show') {
      return (
        <div className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-1 rounded">
          TV Show
          {media.seasonNumber ? ` • ${media.seasonNumber} Season${media.seasonNumber > 1 ? 's' : ''}` : ''}
          {media.totalEpisodes ? ` • ${media.totalEpisodes} Episodes` : ''}
          {media.year ? ` • ${media.year}` : ''}
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[calc(100vh-80px)] max-h-[calc(100vh-80px)] p-0 overflow-hidden flex flex-col rounded-lg">
        <div className="flex-1 flex flex-col">
          {/* Close button */}
          <div className="absolute right-3 top-3 z-50">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        
          {/* Content area */}
          <div className="flex-1 flex bg-black justify-center items-center overflow-hidden">
            {/* Video Viewer */}
            {media.type === "video" && (
              <div className="w-full h-full max-w-full flex items-center justify-center p-0 bg-black">
                <IframeVideoPlayer
                  mediaId={media.id}
                  className="w-full h-full"
                  onError={handleVideoError}
                  onLoad={handleVideoLoad}
                />
              </div>
            )}
            
            {/* Error State */}
            {error && (
              <div className="w-full h-full flex items-center justify-center p-4 bg-gray-100">
                <div className="bg-white rounded-lg shadow-lg p-6 max-w-xl text-center">
                  <h3 className="text-xl font-semibold mb-4 text-red-600">Error Loading Content</h3>
                  <p className="text-gray-500 mb-6">
                    {error.message || "There was a problem loading this content. Please try again later."}
                  </p>
                  <Button onClick={onClose} variant="outline">Close</Button>
                </div>
              </div>
            )}
            
            {/* Loading State */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="loading-spinner"></div>
              </div>
            )}
          </div>
          
          {/* Footer with metadata */}
          <div className="bg-white px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 flex-shrink-0">
            <DialogHeader className="space-y-1 sm:space-y-2">
              <DialogTitle className="text-lg sm:text-xl">{media.title}</DialogTitle>
              
              {/* Content Classification Badge */}
              {getContentBadge()}
              
              <DialogDescription className="text-xs sm:text-sm">{media.description}</DialogDescription>
            </DialogHeader>
            
            <div className="flex justify-between items-center mt-3 sm:mt-4">
              {/* Type badge */}
              <div className={`text-xs px-2 py-1 rounded capitalize ${typeColor}`}>
                {media.type}
              </div>
              
              {/* Contact button */}
              <Button size="sm" variant="outline" onClick={handleContactClick} className="gap-2">
                <Mail className="h-3 w-3" />
                <span className="hidden sm:inline">Contact Us</span>
                <span className="sm:hidden">Contact</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}