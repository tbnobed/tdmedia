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
  
  // Fetch stream info
  const { data: streamInfo, isLoading, error } = useQuery<StreamInfo>({
    queryKey: [`/api/stream/${mediaId}`],
    enabled: !!mediaId,
    queryFn: async () => {
      const baseUrl = window.TBN_CONFIG?.apiBaseUrl || '';
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
  const videoUrl = `${window.TBN_CONFIG?.apiBaseUrl || ''}${streamInfo.streamUrl}`;
  
  // Create an enhanced HTML document that contains the video with appropriate watermarks
  // and fullscreen restrictions based on user role
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
        
        /* Watermark styles */
        .watermark-container {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 10;
        }
        
        .watermark-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 2.5rem;
          font-weight: bold;
          color: rgba(255, 255, 255, 0.08);
          white-space: nowrap;
        }
        
        .watermark-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          grid-template-rows: repeat(4, 1fr);
          width: 100%;
          height: 100%;
        }
        
        .watermark-grid-item {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .watermark-grid-item span {
          transform: rotate(-30deg);
          font-size: 0.8rem;
          color: rgba(255, 255, 255, 0.06);
          font-weight: 400;
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
        ${streamInfo.thumbnailUrl ? `poster="${window.TBN_CONFIG?.apiBaseUrl || ''}${streamInfo.thumbnailUrl}"` : ''}
      >
        Your browser does not support the video tag.
      </video>
      
      <div id="watermarkContainer" class="watermark-container" style="display: none;">
        <!-- We're removing the center watermark text to avoid duplication -->
        
        <div class="watermark-grid">
          ${Array.from({ length: 12 }).map((_, index) => `
            <div class="watermark-grid-item">
              <span>TBN</span>
            </div>
          `).join('')}
        </div>
      </div>
      
      <script>
        const video = document.querySelector('video');
        const watermarkContainer = document.getElementById('watermarkContainer');
        
        // Prevent right-click on the entire document
        document.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          return false;
        }, false);
        
        // Prevent drag and drop of video elements
        document.addEventListener('dragstart', function(e) {
          e.preventDefault();
          return false;
        }, false);
        
        // Function to check response headers for watermarking instructions
        async function checkWatermarkHeaders() {
          try {
            // Make a HEAD request to the video URL to get headers
            const response = await fetch('${videoUrl}', {
              method: 'HEAD',
              credentials: 'include'
            });
            
            // Check if watermarking is required based on headers
            const watermarkRequired = response.headers.get('X-TBN-Watermark') === 'required';
            const userRole = response.headers.get('X-TBN-Role') || 'client';
            
            console.log('Video headers:', {
              watermarkRequired,
              userRole
            });
            
            // Show watermark for client users or if specifically required
            if (watermarkRequired || userRole === 'client') {
              watermarkContainer.style.display = 'block';
            }
            
            // Apply fullscreen restrictions based on user role
            if (userRole !== 'admin') {
              applyFullscreenRestrictions();
            }
          } catch (error) {
            console.error('Error checking watermark headers:', error);
            // Default to showing watermark on error
            watermarkContainer.style.display = 'block';
            applyFullscreenRestrictions();
          }
        }
        
        // Function to apply fullscreen restrictions
        function applyFullscreenRestrictions() {
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
          
          // Additional download prevention
          video.oncontextmenu = function(e) { 
            e.preventDefault(); 
            return false; 
          };
        }
        
        // Check watermark requirements when video is loaded
        video.addEventListener('loadedmetadata', checkWatermarkHeaders);
        
        // Apply fullscreen restrictions by default for safety
        applyFullscreenRestrictions();
        
        // Detect and block any attempts to download or save the video
        video.addEventListener('copy', function(e) {
          e.preventDefault();
          return false;
        });
        
        video.addEventListener('cut', function(e) {
          e.preventDefault();
          return false;
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
      
      {/* 
        Note: We've moved the watermark inside the iframe for better security
        and to make it impossible for users to remove it using browser dev tools.
        The watermark is controlled by the server-side X-TBN-Watermark header.
      */}
    </div>
  );
}