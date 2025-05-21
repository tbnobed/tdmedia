import { useEffect, useState } from "react";
import { Media } from "@shared/schema";
import { getMediaTypeColor, getContentClassification } from "@/lib/media-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Mail, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VideoPlayer from "./video-player";
import IframeVideoPlayer from "./iframe-video-player";
import "./media-viewer.css";

interface MediaViewerProps {
  media: Media | null;
  isOpen: boolean;
  onClose: () => void;
  onContactRequest: (media: Media) => void;
}

interface StreamInfo {
  streamUrl: string;
  mediaType: string;
  title: string;
}

export default function MediaViewer({ media, isOpen, onClose, onContactRequest }: MediaViewerProps) {
  const [activeViewer, setActiveViewer] = useState<"video" | "image" | "document">("video");
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Set the appropriate viewer based on media type
  useEffect(() => {
    if (media) {
      switch (media.type) {
        case "video":
          setActiveViewer("video");
          break;
        case "image":
          setActiveViewer("image");
          break;
        case "document":
        case "presentation":
          setActiveViewer("document");
          break;
        default:
          setActiveViewer("document");
      }
    }
  }, [media]);
  
  // Fetch stream info for image viewer
  const { data: imageStreamInfo, isLoading: isImageLoading, error: imageError } = useQuery<StreamInfo>({
    queryKey: [`/api/stream/${media?.id}`],
    enabled: isOpen && !!media && activeViewer === "image",
    queryFn: async () => {
      const baseUrl = window.TRILOGY_CONFIG?.apiBaseUrl || '';
      const url = `/api/stream/${media?.id}`;
      const fullUrl = `${baseUrl}${url}`;
      
      const res = await fetch(fullUrl, {
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch stream info: ${res.status} ${res.statusText}`);
      }
      
      return res.json();
    },
  });
  
  if (!media) return null;
  
  const typeColor = getMediaTypeColor(media.type);
  
  const handleContactClick = () => {
    onClose();
    onContactRequest(media);
  };
  
  // Prevent right-click on media content
  const preventRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1200px] p-0 overflow-hidden w-[95vw] h-auto max-h-[90vh] flex flex-col" onContextMenu={preventRightClick}>
        <div className="absolute top-0 right-0 pt-3 pr-3 sm:pt-4 sm:pr-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white/90 h-7 w-7 sm:h-8 sm:w-8"
            onClick={onClose}
          >
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
        
        {/* Media Container - Adjusted for proper aspect ratio without extra space */}
        <div className="bg-gray-900 relative" style={{ height: 'auto', aspectRatio: '16/9' }}>
          {/* Watermark - only for images, we're using the iframe watermark for videos */}
          {activeViewer === "image" && (
            <div className="watermark-container">
              {/* Grid watermark pattern for images only */}
              <div className="watermark-grid">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="watermark-grid-item text-xs sm:text-sm">
                    TBN
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Video Player - Using iframe player for better fullscreen control */}
          {activeViewer === "video" && media && (
            <div className="w-full h-full">
              <IframeVideoPlayer 
                mediaId={media.id}
                showWatermark={true}
                onError={(e) => setError(e)}
                onLoad={() => setIsLoading(false)}
                className="w-full h-full"
              />
            </div>
          )}
          
          {/* Image Viewer */}
          {activeViewer === "image" && (
            <div className={`w-full h-full relative ${isImageLoading ? 'hidden' : ''}`}>
              {imageStreamInfo && (
                <img
                  src={`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${imageStreamInfo.streamUrl}`}
                  className="w-full h-full object-contain"
                  alt={media.title}
                  onContextMenu={preventRightClick}
                />
              )}
            </div>
          )}
          
          {/* Document Viewer */}
          {activeViewer === "document" && (
            <div className={`w-full h-full bg-white relative ${isLoading ? 'hidden' : ''}`}>
              {/* Special diagonal repeating watermark for documents */}
              <div className="absolute inset-0 bg-black/3 overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-10 opacity-10">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <div key={index} className="flex items-center justify-center">
                      <div className="transform rotate-[-30deg] text-gray-700 text-xs sm:text-sm font-normal">
                        TBN
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center z-10 px-3">
                  <div className="text-4xl sm:text-5xl text-gray-400 flex justify-center mb-2">
                    {media.type === "document" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-12 sm:h-12">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-12 sm:h-12">
                        <path d="M2 3h20v14H2z"></path>
                        <path d="M12 21l5-5H7l5 5z"></path>
                      </svg>
                    )}
                  </div>
                  <p className="mt-2 text-white bg-black/70 px-2 py-1 rounded text-xs sm:text-sm sm:px-3">
                    Document preview is available for viewing only
                  </p>
                  <p className="mt-2 text-gray-600 text-xs sm:text-sm">
                    Content is protected and watermarked
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-10 w-10 sm:h-16 sm:w-16 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
        
        {/* Info Section - Set to auto height to fit content */}
        <div className="bg-white px-3 pt-3 pb-2 sm:px-4 sm:pt-4 sm:pb-3 flex-shrink-0">
          <DialogHeader className="space-y-1 sm:space-y-2">
            <DialogTitle className="text-lg sm:text-xl">{media.title}</DialogTitle>
            
            {/* Content Classification Badge */}
            {getContentClassification(media) && (
              <div className="text-xs text-blue-600 font-medium bg-blue-50 inline-block px-2 py-1 rounded">
                {getContentClassification(media)}
              </div>
            )}
            
            <DialogDescription className="text-xs sm:text-sm">{media.description}</DialogDescription>
          </DialogHeader>
          
          <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${typeColor.bg} ${typeColor.text}`}>
                  {media.type.charAt(0).toUpperCase() + media.type.slice(1)}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {media.duration || media.size || ""}
                </span>
              </div>
              
              <Button 
                onClick={handleContactClick}
                className="text-xs sm:text-sm h-8 sm:h-10 bg-gradient-to-r from-black to-gray-800 hover:from-gray-900 hover:to-gray-700 text-white"
                size="sm"
              >
                <Mail className="mr-1 h-3 w-3 sm:mr-2 sm:h-4 sm:w-4" /> 
                <span className="sm:inline">Contact about this content</span>
                <span className="sm:hidden">Contact us</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
