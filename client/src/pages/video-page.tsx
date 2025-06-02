import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Clock, Globe, Tag } from "lucide-react";
import { CustomVideoPlayer } from "@/components/media/custom-video-player";

export default function VideoPage() {
  const [, setLocation] = useLocation();
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [mediaId, setMediaId] = useState<string | null>(null);
  
  useEffect(() => {
    // Get media ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    setMediaId(id);
    
    if (id) {
      // Fetch the stream URL for this media
      fetch(`/api/stream/${id}`, {
        credentials: 'include'
      })
      .then(res => res.json())
      .then(data => {
        setVideoUrl(`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${data.streamUrl}`);
      })
      .catch(err => console.error('Error loading video:', err));
    }
  }, []);

  // Fetch media details
  const { data: media, isLoading } = useQuery({
    queryKey: ['/api/media', mediaId],
    queryFn: async () => {
      if (!mediaId) return null;
      const response = await fetch(`/api/media/${mediaId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch media details');
      return response.json();
    },
    enabled: !!mediaId
  });

  const getLanguageBadgeColor = (language: string) => {
    switch (language?.toLowerCase()) {
      case 'english': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'spanish': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'bilingual': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'video': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'audio': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'podcast': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <style>{`
        video::-webkit-media-controls-fullscreen-button {
          display: none !important;
        }
        video::-moz-media-controls-fullscreen-button {
          display: none !important;
        }
        video::--ms-media-controls-fullscreen-button {
          display: none !important;
        }
      `}</style>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {/* Video Player Section */}
          <div className="lg:col-span-2">
            <div className="relative">
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
              
              {/* Custom Video Player - No fullscreen capability */}
              {videoUrl ? (
                <CustomVideoPlayer
                  src={videoUrl}
                  autoPlay={true}
                  onContextMenu={(e) => e.preventDefault()}
                />
              ) : (
                <div className="w-full h-96 bg-gray-800 flex items-center justify-center rounded-lg">
                  <p className="text-white">Loading video...</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Media Information Section */}
          <div className="lg:col-span-1">
            {isLoading ? (
              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-700 rounded mb-4"></div>
                    <div className="h-4 bg-gray-700 rounded mb-2"></div>
                    <div className="h-4 bg-gray-700 rounded mb-4"></div>
                    <div className="flex gap-2 mb-4">
                      <div className="h-6 w-16 bg-gray-700 rounded"></div>
                      <div className="h-6 w-20 bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : media ? (
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white text-xl">{media.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {media.description && (
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {media.description}
                    </p>
                  )}
                  
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {media.type && (
                      <Badge variant="outline" className={getTypeBadgeColor(media.type)}>
                        <Tag className="h-3 w-3 mr-1" />
                        {media.type}
                      </Badge>
                    )}
                    {media.language && (
                      <Badge variant="outline" className={getLanguageBadgeColor(media.language)}>
                        <Globe className="h-3 w-3 mr-1" />
                        {media.language}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Media Details */}
                  <div className="space-y-2 text-sm text-gray-400">
                    {media.duration && (
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2" />
                        Duration: {media.duration}
                      </div>
                    )}
                    {media.createdAt && (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        Added: {new Date(media.createdAt).toLocaleDateString()}
                      </div>
                    )}
                    {media.fileSize && (
                      <div className="flex items-center">
                        <Tag className="h-4 w-4 mr-2" />
                        Size: {media.fileSize}
                      </div>
                    )}
                  </div>
                  
                  {/* Playlist Information */}
                  {media.playlist && (
                    <div className="pt-4 border-t border-gray-700">
                      <p className="text-sm text-gray-400">
                        <strong className="text-gray-300">Playlist:</strong> {media.playlist.name}
                      </p>
                      {media.playlist.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {media.playlist.description}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gray-900 border-gray-700">
                <CardContent className="p-6">
                  <p className="text-gray-400">Media information not available</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}