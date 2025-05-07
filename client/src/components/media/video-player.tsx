import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import "./video-player.css";

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
  
  // Enhanced right-click prevention on media content
  const preventRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Show a message to clients so they know downloads are disabled
    if (!user?.isAdmin) {
      const warning = "Content downloading is disabled. This media is watermarked for your preview only.";
      console.log(warning);
      
      // Display a warning message when right-click is attempted
      if (window.getSelection) window.getSelection()?.removeAllRanges();
      
      // Show warning tooltip instead of alert
      const tooltip = document.createElement('div');
      tooltip.className = 'right-click-warning';
      tooltip.textContent = 'Downloads are disabled. This content is watermarked for preview only.';
      tooltip.style.position = 'absolute';
      tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
      tooltip.style.color = 'white';
      tooltip.style.padding = '8px 12px';
      tooltip.style.borderRadius = '4px';
      tooltip.style.fontSize = '14px';
      tooltip.style.zIndex = '9999';
      tooltip.style.pointerEvents = 'none';
      
      document.body.appendChild(tooltip);
      
      // Position tooltip near cursor
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      tooltip.style.left = `${mouseX + 10}px`;
      tooltip.style.top = `${mouseY + 10}px`;
      
      // Remove tooltip after 2 seconds
      setTimeout(() => {
        document.body.removeChild(tooltip);
      }, 2000);
    }
    
    return false;
  };
  
  // Disable drag and drop capabilities
  const preventDragStart = (e: React.DragEvent) => {
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
      
      // Add event listener for key events that might trigger fullscreen (F11, etc.)
      const handleKeyDown = (e: KeyboardEvent) => {
        // Check for fullscreen key combinations
        if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
          console.log("Fullscreen keyboard shortcut blocked");
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };
      
      // Add the keyboard event listener to the video element
      videoRef.current.addEventListener('keydown', handleKeyDown);
      
      // Clean up on unmount
      return () => {
        if (videoRef.current) {
          videoRef.current.requestFullscreen = originalRequestFullscreen;
          videoRef.current.removeEventListener('keydown', handleKeyDown);
        }
      };
    }
  }, [disableFullscreen, videoRef.current]);
  
  // Add global right-click prevention when video is loaded for non-admin users
  useEffect(() => {
    if (!user?.isAdmin && videoRef.current && streamInfo) {
      // Add global document level right-click prevention
      const globalRightClickHandler = (e: MouseEvent) => {
        e.preventDefault();
        console.log("Global right-click prevented in video player");
        return false;
      };
      
      // Add global copy/drag prevention
      const globalCopyHandler = (e: ClipboardEvent) => {
        e.preventDefault();
        return false;
      };
      
      const globalDragHandler = (e: DragEvent) => {
        e.preventDefault();
        return false;
      };
      
      // Add event listeners
      document.addEventListener('contextmenu', globalRightClickHandler);
      document.addEventListener('copy', globalCopyHandler);
      document.addEventListener('dragstart', globalDragHandler);
      
      // Cleanup when component unmounts
      return () => {
        document.removeEventListener('contextmenu', globalRightClickHandler);
        document.removeEventListener('copy', globalCopyHandler);
        document.removeEventListener('dragstart', globalDragHandler);
      };
    }
  }, [user?.isAdmin, videoRef.current, streamInfo]);

  // Global fullscreen change detection and keyboard shortcut prevention
  useEffect(() => {
    if (disableFullscreen) {
      // Handle fullscreen change events
      const handleFullscreenChange = () => {
        const isFullScreen = !!(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement ||
          (document as any).msFullscreenElement
        );
        
        // If fullscreen is active but should be disabled, exit fullscreen
        if (isFullScreen && videoRef.current) {
          console.log("Exiting unwanted fullscreen");
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          } else if ((document as any).mozCancelFullScreen) {
            (document as any).mozCancelFullScreen();
          } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen();
          }
        }
      };
      
      // Prevent keyboard shortcuts that might trigger fullscreen
      const preventFullscreenKeys = (e: KeyboardEvent) => {
        // F11 key for fullscreen
        if (e.key === 'F11') {
          e.preventDefault();
          console.log("F11 fullscreen prevented for client users");
          return false;
        }
        
        // Cmd/Ctrl + Shift + F for fullscreen in some browsers
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          console.log("Ctrl+Shift+F fullscreen prevented for client users");
          return false;
        }
        
        // Alt + Enter for fullscreen in some applications
        if (e.altKey && e.key === 'Enter') {
          e.preventDefault();
          console.log("Alt+Enter fullscreen prevented for client users");
          return false;
        }
      };
      
      // Listen for fullscreen changes
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.addEventListener('mozfullscreenchange', handleFullscreenChange);
      document.addEventListener('MSFullscreenChange', handleFullscreenChange);
      
      // Listen for keyboard shortcuts
      document.addEventListener('keydown', preventFullscreenKeys, true);
      
      return () => {
        // Clean up event listeners
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
        document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        document.removeEventListener('keydown', preventFullscreenKeys, true);
      };
    }
  }, [disableFullscreen]);

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

  // Set the allowFullScreen attribute at the container level (with proper camelCase)
  // This is a critical attribute that browsers look for when allowing fullscreen mode
  const containerProps = disableFullscreen 
    ? { allowFullScreen: false } 
    : { allowFullScreen: true };
    
  // Log the current video player configuration
  console.log("VideoPlayer Config:", {
    isAdmin: user?.isAdmin,
    allowFullscreenProp: allowFullscreen, 
    disableFullscreen, 
    containerProps
  });
  
  return (
    <div className={`relative ${className} ${disableFullscreen ? 'client-video-container fullscreen-disabled' : ''}`} {...containerProps}>
      {/* Watermark overlay for full-size player */}
      {showWatermark && !small && (
        <div className="watermark-container absolute inset-0 pointer-events-none z-10">
          {/* Grid watermark pattern - without central watermark to avoid duplication */}
          <div className="watermark-grid absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-5">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="flex items-center justify-center">
                <div className="transform rotate-[-30deg] text-white text-xs font-normal">
                  TRILOGY DIGITAL
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Video player */}
      {streamInfo && (
        <div className="relative">
          <video
            ref={videoRef}
            className={`w-full ${small ? 'h-24 object-cover' : 'h-full'} ${disableFullscreen ? 'client-video fullscreen-disabled' : ''}`}
            controls={controls}
            controlsList={`nodownload ${disableFullscreen ? 'nofullscreen' : ''}`}
            onContextMenu={preventRightClick}
            onDragStart={preventDragStart}
            autoPlay={autoPlay}
            preload="auto"
            playsInline
            muted={muted}
            disableRemotePlayback
            disablePictureInPicture
            // Set all possible fullscreen attributes to false for client users
            {...(disableFullscreen ? { 
              allowFullScreen: false
            } : {
              allowFullScreen: true
            })}
          >
            <source 
              src={`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${streamInfo.streamUrl}`} 
              type="video/mp4" 
            />
            Your browser does not support the video tag.
          </video>
          
          {/* Overlay element to block fullscreen button */}
          {disableFullscreen && (
            <div 
              className="fullscreen-blocker" 
              title="Fullscreen is disabled for client users"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                alert("Fullscreen is disabled for client users");
                return false;
              }}
            />
          )}
        </div>
      )}
      
      {/* Small watermark in the preview version */}
      {small && showWatermark && (
        <div className="absolute top-1 right-1 text-white text-xs opacity-40 bg-black/20 px-1 rounded">
          TRILOGY
        </div>
      )}
    </div>
  );
}