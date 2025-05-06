import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

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
  allowFullscreen?: boolean;
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
  onLoad,
  allowFullscreen
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();
  
  // Determine if fullscreen should be allowed
  // If allowFullscreen prop is explicitly provided, use that value
  // Otherwise, only allow fullscreen for admin users
  // Force disable fullscreen for non-admin users
  // If allowFullscreen is explicitly set to true, only then allow it for admins
  // Otherwise, disable for everyone
  console.log("VideoPlayer user info:", {isAdmin: user?.isAdmin, allowFullscreen});
  // Always disable fullscreen for client users, only enable for admins with explicit true prop
  const disableFullscreen = !user?.isAdmin || (allowFullscreen === undefined ? true : !allowFullscreen);
  console.log("Fullscreen disabled:", disableFullscreen);
  
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
  
  // Prevent fullscreen for non-admin users with direct JavaScript
  useEffect(() => {
    if (disableFullscreen && videoRef.current) {
      // Override the requestFullscreen method to prevent fullscreen
      const originalRequestFullscreen = videoRef.current.requestFullscreen;
      videoRef.current.requestFullscreen = function() {
        console.log("Fullscreen request blocked by policy");
        return Promise.reject(new Error("Fullscreen is disabled for client users"));
      };
      
      // Clean up on unmount
      return () => {
        if (videoRef.current) {
          videoRef.current.requestFullscreen = originalRequestFullscreen;
        }
      };
    }
  }, [disableFullscreen, videoRef.current]);

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

  // Set the allowFullscreen attribute at the container level
  // This is a critical attribute that browsers look for when allowing fullscreen mode
  const containerProps = disableFullscreen 
    ? { allowFullscreen: "false" } 
    : { allowFullscreen: "true" };
    
  // Log the current video player configuration
  console.log("VideoPlayer Config:", {
    isAdmin: user?.isAdmin,
    allowFullscreenProp: allowFullscreen, 
    disableFullscreen, 
    containerProps
  });
  
  return (
    <div className={`relative ${className}`} {...containerProps}>
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
          controlsList={`nodownload ${disableFullscreen ? 'nofullscreen' : ''}`}
          onContextMenu={preventRightClick}
          autoPlay={autoPlay}
          preload="auto"
          playsInline
          muted={muted}
          disablePictureInPicture
          disableRemotePlayback
          // Critical: explicitly set allowFullScreen attribute based on our logic
          {...(disableFullscreen ? { disablefullscreen: "true" } : {})}
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