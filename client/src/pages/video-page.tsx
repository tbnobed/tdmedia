import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function VideoPage() {
  const [, setLocation] = useLocation();
  const [videoUrl, setVideoUrl] = useState<string>("");
  
  useEffect(() => {
    // Get media ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const mediaId = urlParams.get('id');
    
    if (mediaId) {
      // Fetch the stream URL for this media
      fetch(`/api/stream/${mediaId}`, {
        credentials: 'include'
      })
      .then(res => res.json())
      .then(data => {
        setVideoUrl(`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${data.streamUrl}`);
      })
      .catch(err => console.error('Error loading video:', err));
    }
  }, []);

  return (
    <div className="min-h-screen bg-black">
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => setLocation('/')}
          className="text-white hover:bg-white/20 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Media Catalog
        </Button>
      </div>
      
      <div className="container mx-auto px-4">
        <div className="relative max-w-6xl mx-auto">
          {/* TBN Logo Watermark */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-8 p-8">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="flex items-center justify-center">
                  <img 
                    src="/images/tbn-logo-white.png" 
                    alt="TBN" 
                    className="transform rotate-[-30deg] opacity-20 w-20" 
                  />
                </div>
              ))}
            </div>
          </div>
          
          {/* Video Player */}
          {videoUrl && (
            <video
              controls
              autoPlay
              className="w-full h-auto bg-black"
              src={videoUrl}
              onContextMenu={(e) => e.preventDefault()}
              controlsList="nodownload"
              disablePictureInPicture
              playsInline
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          )}
          
          {!videoUrl && (
            <div className="w-full h-96 bg-gray-800 flex items-center justify-center">
              <p className="text-white">Loading video...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}