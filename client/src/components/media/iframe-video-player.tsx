import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import './iframe-video-player.css';

interface IframeVideoPlayerProps {
  mediaId: number;
  className?: string;
  small?: boolean;
  showWatermark?: boolean;
  onError?: (error: Error) => void;
  onLoad?: () => void;
}

interface StreamInfo {
  streamUrl: string;
  mediaType: string;
  title: string;
  thumbnailUrl?: string; // Optional thumbnail URL for video poster
}

export default function IframeVideoPlayer({
  mediaId,
  className = '',
  small = false,
  showWatermark = true,
  onError,
  onLoad
}: IframeVideoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user } = useAuth();
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);
  
  // This is the critical function - we use an iframe with allowFullScreen={false}
  // which is the most reliable way to restrict fullscreen capabilities
  
  // Get user info from auth context
  console.log("VideoPlayer user info:", user);
  const isDisableFullscreen = !user?.isAdmin;
  console.log("Fullscreen disabled:", isDisableFullscreen);
  console.log("VideoPlayer Config:", {
    isAdmin: user?.isAdmin,
    disableFullscreen: isDisableFullscreen,
    containerProps: {
      allowFullScreen: false
    }
  });
  
  // Fetch stream info - using a more reliable approach
  const { data: streamInfo, isLoading, error } = useQuery<StreamInfo>({
    queryKey: [`/api/stream/${mediaId}`],
    enabled: !!mediaId,
    retry: 1,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
    queryFn: async () => {
      try {
        // Get API base URL from window config or default to empty string
        const baseUrl = window.TRILOGY_CONFIG?.apiBaseUrl || '';
        const url = `/api/stream/${mediaId}`;
        const fullUrl = `${baseUrl}${url}`;
        
        const res = await fetch(fullUrl, {
          credentials: "include",
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!res.ok) {
          throw new Error(`Failed to fetch stream info: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log(`Stream info received for media ID: ${mediaId}`);
        return data;
      } catch (err) {
        console.error(`Stream fetch error for media ID ${mediaId}:`, err);
        throw err;
      }
    },
  });
  
  // Handle errors
  useEffect(() => {
    if (error && onError) {
      onError(error as Error);
    }
  }, [error, onError]);
  
  // Call onLoad callback when iframe is loaded
  useEffect(() => {
    if (isIframeLoaded && onLoad) {
      onLoad();
    }
  }, [isIframeLoaded, onLoad]);

  // Prevent default behavior for fullscreen keyboard shortcuts
  useEffect(() => {
    const preventFullscreenKeys = (e: KeyboardEvent) => {
      if (e.key === 'F11' || 
          (e.key === 'f' && e.ctrlKey) || 
          (e.key === 'Enter' && e.altKey) ||
          (e.key === 'f' && e.ctrlKey && e.shiftKey)) {
        e.preventDefault();
        return false;
      }
    };
    
    window.addEventListener('keydown', preventFullscreenKeys, true);
    
    return () => {
      window.removeEventListener('keydown', preventFullscreenKeys, true);
    };
  }, []);
  
  if (isLoading) {
    return (
      <div className={`loader ${className}`}>
        <div className="loading-spinner"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-900 text-white ${className}`}>
        <div className="text-center p-2">
          <p className="text-sm font-semibold">Error loading video</p>
        </div>
      </div>
    );
  }
  
  if (!streamInfo) {
    return null;
  }
  
  // Construct the video URL
  const videoUrl = `${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${streamInfo.streamUrl}`;
  
  // Create a simplified HTML document that contains the video with appropriate watermarks
  // using a more reliable approach to prevent browser crashes
  const iframeContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background-color: #000;
        }
        body {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .video-container {
          width: 100%;
          max-width: 100%;
          position: relative;
        }
        video {
          width: 100%;
          height: auto;
          max-height: 100%;
          display: block;
        }
        video::-webkit-media-controls-fullscreen-button {
          display: none !important;
        }
        
        /* Simple watermark styles for better performance */
        .watermark-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(3, 1fr);
        }
        
        .watermark-item {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .watermark-logo {
          transform: rotate(-30deg);
          width: 105px; /* Increased by 75% from 60px */
          opacity: 0.15;
          filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
        }
      </style>
    </head>
    <body>
      <div class="video-container">
        <video 
          id="videoPlayer"
          src="${videoUrl}" 
          controls 
          autoplay
          controlsList="nodownload nofullscreen"
          playsinline
          disablePictureInPicture
          ${streamInfo.thumbnailUrl ? `poster="${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${streamInfo.thumbnailUrl}"` : ''}
        >
          Your browser does not support the video tag.
        </video>
        
        <div id="watermarkContainer" class="watermark-container">
          ${Array.from({ length: 9 }).map(() => `
            <div class="watermark-item">
              <img src="${window.TRILOGY_CONFIG?.apiBaseUrl || ''}/images/tbn-logo-white.png" class="watermark-logo" alt="TBN Logo" />
            </div>
          `).join('')}
        </div>
      </div>
      
      <script>
        // Get references to elements
        const video = document.getElementById('videoPlayer');
        const watermarkContainer = document.getElementById('watermarkContainer');
        
        // Prevent right-click
        document.addEventListener('contextmenu', e => e.preventDefault());
        
        // Prevent drag and drop
        document.addEventListener('dragstart', e => e.preventDefault());
        
        // Simple fullscreen prevention
        document.addEventListener('fullscreenchange', () => {
          if (document.fullscreenElement) document.exitFullscreen();
        });
        
        // Simple keyboard prevention for fullscreen shortcuts
        document.addEventListener('keydown', e => {
          if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
            e.preventDefault();
          }
        });
        
        // Prevent download attempts
        video.addEventListener('copy', e => e.preventDefault());
        video.addEventListener('cut', e => e.preventDefault());
      </script>
    </body>
    </html>
  `;
  
  // Convert the HTML to a data URL
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(iframeContent)}`;
  
  return (
    <div className={`iframe-container ${className}`}>
      <iframe
        ref={iframeRef}
        src={dataUrl}
        className="iframe-video"
        onLoad={() => setIsIframeLoaded(true)}
        // This is the critical attribute that prevents fullscreen
        allowFullScreen={false}
        allow="autoplay"
        loading="lazy"
        sandbox="allow-same-origin allow-scripts"
      ></iframe>
      
      {/* 
        Note: We've moved the watermark inside the iframe for better security
        and to make it impossible for users to remove it using browser dev tools.
        The watermark is controlled by the server-side X-TBN-Watermark header.
      */}
    </div>
  );
}