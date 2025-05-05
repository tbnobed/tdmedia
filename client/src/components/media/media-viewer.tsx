import { useRef, useEffect, useState } from "react";
import { Media } from "@shared/schema";
import { getMediaTypeColor } from "@/lib/media-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Mail, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeViewer, setActiveViewer] = useState<"video" | "image" | "document">("video");
  
  // Fetch stream URL when media changes
  const { data: streamInfo, isLoading } = useQuery<StreamInfo>({
    queryKey: ["/api/stream", media?.id],
    enabled: isOpen && !!media,
  });
  
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
  
  // Pause video when dialog closes
  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
    }
  }, [isOpen]);
  
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden" onContextMenu={preventRightClick}>
        <div className="absolute top-0 right-0 pt-4 pr-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-white/80 backdrop-blur-sm hover:bg-white/90"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="bg-gray-900 aspect-video relative">
          {/* Watermark */}
          <div className="watermark"></div>
          
          {/* Video Player */}
          {activeViewer === "video" && (
            <video
              ref={videoRef}
              className={`w-full h-full ${isLoading ? 'hidden' : ''}`}
              controls
              controlsList="nodownload"
              onContextMenu={preventRightClick}
            >
              {streamInfo && <source src={streamInfo.streamUrl} type="video/mp4" />}
              Your browser does not support the video tag.
            </video>
          )}
          
          {/* Image Viewer */}
          {activeViewer === "image" && (
            <div className={`w-full h-full relative ${isLoading ? 'hidden' : ''}`}>
              {streamInfo && (
                <img
                  src={streamInfo.streamUrl}
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
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-5xl text-gray-400 flex justify-center mb-2">
                    {media.type === "document" ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h20v14H2z"></path>
                        <path d="M12 21l5-5H7l5 5z"></path>
                      </svg>
                    )}
                  </div>
                  <p className="mt-2 text-white bg-black/70 px-3 py-1 rounded">
                    Document preview is available for viewing only
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}
        </div>
        
        <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{media.title}</DialogTitle>
            <DialogDescription>{media.description}</DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColor.bg} ${typeColor.text}`}>
                  {media.type.charAt(0).toUpperCase() + media.type.slice(1)}
                </span>
                <span className="ml-2 text-sm text-gray-500">
                  {media.duration || media.size || ""}
                </span>
              </div>
              
              <Button onClick={handleContactClick}>
                <Mail className="mr-2 h-4 w-4" /> Contact about this content
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
