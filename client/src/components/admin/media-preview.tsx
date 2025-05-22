import { useState } from "react";
import { Media } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, Download } from "lucide-react";
import VideoPlayer from "../media/video-player";

interface MediaPreviewProps {
  media: Media | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function MediaPreview({ media, isOpen, onClose }: MediaPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Get the base URL for the API
  const apiBaseUrl = window.TBN_CONFIG?.apiBaseUrl || '';

  if (!media) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{media.title}</DialogTitle>
          <DialogDescription>
            {media.description || "No description provided"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 overflow-hidden rounded-md bg-gray-950 relative">
          {/* Video Player */}
          {media.type === "video" && (
            <div className="relative w-full aspect-video">
              <VideoPlayer 
                mediaId={media.id} 
                autoPlay={true}
                showWatermark={false} 
                allowFullscreen={true}
                onError={(e) => setError(e)}
                onLoad={() => setIsLoading(false)}
              />
            </div>
          )}
          
          {/* Image Viewer */}
          {media.type === "image" && (
            <div className="w-full h-full flex items-center justify-center">
              <img 
                src={media.fileUrl} 
                alt={media.title}
                className="max-h-full max-w-full"
                onLoad={() => setIsLoading(false)}
                onError={() => setError(new Error("Failed to load image"))}
              />
            </div>
          )}
          
          {/* Document/Presentation Viewer */}
          {(media.type === "document" || media.type === "presentation") && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center p-8">
                <div className="text-6xl text-white mb-4">
                  {media.type === "document" ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h20v14H2z"></path>
                      <path d="M12 21l5-5H7l5 5z"></path>
                    </svg>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {media.type === "document" ? "Document Preview" : "Presentation Preview"}
                </h3>
                <p className="text-gray-400 mb-4">
                  {media.type === "document" 
                    ? "Preview is limited in the admin dashboard. Please use the client view to see the watermarked version."
                    : "Presentation preview is limited in the admin dashboard. Please use the client view to see the watermarked version."}
                </p>
                <div className="flex justify-center space-x-4">
                  <Button variant="outline" className="bg-white/10">
                    <Eye className="mr-2 h-4 w-4" /> View in Client
                  </Button>
                  <Button variant="outline" className="bg-white/10">
                    <Download className="mr-2 h-4 w-4" /> Download Original
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}
          
          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center p-4">
                <p className="text-white text-lg font-semibold">Error Loading Media</p>
                <p className="text-red-400 mt-2">{error.message}</p>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              <span className="font-medium">Type:</span> {media.type.charAt(0).toUpperCase() + media.type.slice(1)}
              {media.size && <span className="ml-4"><span className="font-medium">Size:</span> {media.size}</span>}
              {media.duration && <span className="ml-4"><span className="font-medium">Duration:</span> {media.duration}</span>}
            </div>
            
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}