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
  
  // Fetch stream info
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
  
  // Create a minimal HTML document that contains just the video
  // This prevents any fullscreen capabilities that might be available
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
        video {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        video::-webkit-media-controls-fullscreen-button {
          display: none !important;
        }
      </style>
    </head>
    <body>
      <video 
        src="${videoUrl}" 
        controls 
        controlsList="nodownload nofullscreen"
        playsinline
        disablePictureInPicture
      >
        Your browser does not support the video tag.
      </video>
      <script>
        const video = document.querySelector('video');
        
        // Block fullscreen requests
        video.addEventListener('webkitfullscreenchange', (e) => {
          if (document.webkitFullscreenElement) {
            document.webkitExitFullscreen();
          }
        });
        
        video.addEventListener('fullscreenchange', (e) => {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
        });
        
        // Prevent fullscreen via JS
        const origRequestFullscreen = video.requestFullscreen;
        video.requestFullscreen = function() {
          console.log('Fullscreen blocked by restriction');
          return Promise.reject(new Error('Fullscreen is disabled'));
        };
        
        // Block keyboard shortcuts
        document.addEventListener('keydown', (e) => {
          if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
            e.preventDefault();
            return false;
          }
        });
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
        sandbox="allow-same-origin allow-scripts"
      ></iframe>
      
      {/* Watermark overlay */}
      {showWatermark && !small && isIframeLoaded && (
        <div className="watermark-overlay">
          <div className="watermark-text">
            TRILOGY DIGITAL
          </div>
          
          <div className="watermark-grid">
            {Array.from({ length: 16 }).map((_, index) => (
              <div key={index} className="watermark-grid-item">
                <span>TRILOGY DIGITAL</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}