import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface StreamInfo {
  streamUrl: string;
  mediaType: string;
  title: string;
}

interface VideoPlayerProps {
  mediaId: number;
  autoPlay?: boolean;
  controls?: boolean;
  muted?: boolean;
  className?: string;
  small?: boolean;
  showWatermark?: boolean;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

export default function VideoPlayer({
  mediaId,
  autoPlay = false,
  controls = true,
  muted = false,
  className = "",
  small = false,
  showWatermark = false,
  onError,
  onLoad
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Fetch stream URL when media changes
  const { data: streamInfo, isLoading, error } = useQuery<StreamInfo>({
    queryKey: [`/api/stream/${mediaId}`],
    enabled: !!mediaId,
    queryFn: async () => {
      const baseUrl = window.TRILOGY_CONFIG?.apiBaseUrl || '';
      const url = `/api/stream/${mediaId}`;
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

  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error as Error);
    }
  }, [error, onError]);

  // Call onLoad callback when stream info is loaded
  useEffect(() => {
    if (streamInfo && onLoad) {
      onLoad();
    }
  }, [streamInfo, onLoad]);
  
  // Prevent right-click on media content
  const preventRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 ${small ? 'h-24' : 'h-full'} ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-white ${small ? 'h-24' : 'h-full'} ${className}`}>
        <div className="text-center p-2">
          <p className="text-sm font-semibold">Error loading video</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Watermark overlay for full-size player */}
      {showWatermark && !small && (
        <div className="watermark-container absolute inset-0 pointer-events-none z-10">
          {/* Center large watermark text */}
          <div className="watermark-text absolute inset-0 flex items-center justify-center z-10">
            <div className="watermark-content text-white text-3xl font-bold opacity-20">
              TRILOGY DIGITAL TRILOGY DIGITAL TRILOGY DIGITAL
            </div>
          </div>
          
          {/* Grid watermark pattern */}
          <div className="watermark-grid absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-20">
            {Array.from({ length: 16 }).map((_, index) => (
              <div key={index} className="flex items-center justify-center">
                <div className="transform rotate-[-30deg] text-white text-sm font-medium">
                  TRILOGY DIGITAL
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {streamInfo && (
        <video
          ref={videoRef}
          className={`w-full ${small ? 'h-24 object-cover' : 'h-full'}`}
          controls={controls}
          controlsList="nodownload"
          onContextMenu={preventRightClick}
          autoPlay={autoPlay}
          preload="auto"
          playsInline
          muted={muted}
        >
          <source 
            src={`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${streamInfo.streamUrl}`} 
            type="video/mp4" 
          />
          Your browser does not support the video tag.
        </video>
      )}
      
      {/* Small watermark in the preview version */}
      {small && showWatermark && (
        <div className="absolute top-1 right-1 text-white text-xs opacity-70 bg-black/30 px-1 rounded">
          TRILOGY
        </div>
      )}
    </div>
  );
}