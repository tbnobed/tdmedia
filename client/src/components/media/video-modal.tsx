import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Globe, Tag, X, Film, Tv, FileText } from "lucide-react";
import { CustomVideoPlayer } from "./custom-video-player";
import { Button } from "@/components/ui/button";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaId: number | null;
}

export function VideoModal({ isOpen, onClose, mediaId }: VideoModalProps) {
  const [videoUrl, setVideoUrl] = useState<string>("");

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
    enabled: !!mediaId && isOpen
  });

  useEffect(() => {
    if (mediaId && isOpen) {
      // Fetch the stream URL for this media
      fetch(`/api/stream/${mediaId}`, {
        credentials: 'include'
      })
      .then(res => res.json())
      .then(data => {
        setVideoUrl(`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}${data.streamUrl}`);
      })
      .catch(err => console.error('Error loading video:', err));
    } else {
      setVideoUrl("");
    }
  }, [mediaId, isOpen]);

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl w-[87vw] bg-black border-gray-700 p-0 overflow-hidden">
        <div className="flex flex-col">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-20 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Video Player Section - 16:9 Aspect Ratio */}
          <div className="relative bg-black aspect-video">
            {/* TBN Logo Watermark */}
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="absolute inset-0 grid grid-cols-4 grid-rows-3 gap-12 p-12">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div key={index} className="flex items-center justify-center">
                    <img 
                      src="/images/tbn-logo-white.png" 
                      alt="TBN" 
                      className="transform rotate-[-30deg] opacity-15 w-16" 
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* Video Player */}
            <div className="absolute inset-0 flex items-center justify-center">
              {videoUrl ? (
                <div className="w-full h-full">
                  <CustomVideoPlayer
                    src={videoUrl}
                    autoPlay={true}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                </div>
              ) : (
                <div className="w-full h-96 bg-gray-800 flex items-center justify-center rounded-lg">
                  <p className="text-white">Loading video...</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Media Information Section - Below Video */}
          <div className="bg-gradient-to-r from-gray-900 to-black border-t border-gray-700 p-6">
            <div className="max-w-5xl mx-auto">
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-8 bg-gray-700 rounded mb-4 w-1/2"></div>
                  <div className="h-4 bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 bg-gray-700 rounded mb-4 w-3/4"></div>
                  <div className="flex gap-2 mb-4">
                    <div className="h-6 w-16 bg-gray-700 rounded"></div>
                    <div className="h-6 w-20 bg-gray-700 rounded"></div>
                  </div>
                </div>
              ) : media ? (
                <div className="space-y-4">
                  {/* Title and Badges Row */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white mb-2">{media.title}</h2>
                      {media.description && (
                        <p className="text-gray-300 leading-relaxed">
                          {media.description}
                        </p>
                      )}
                    </div>
                    
                    {/* Badges and Details - Top Right */}
                    <div className="flex flex-col items-end gap-2">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-2 justify-end">

                        {media.language && (
                          <Badge variant="outline" className="bg-green-600/20 text-green-300 border-green-500">
                            <Globe className="h-3 w-3 mr-1" />
                            {media.language}
                          </Badge>
                        )}
                        {media.contentType && media.contentType !== 'other' && (
                          <Badge variant="outline" className="bg-purple-600/20 text-purple-300 border-purple-500">
                            {media.contentType === 'film' ? <Film className="h-3 w-3 mr-1" /> : <Tv className="h-3 w-3 mr-1" />}
                            {media.contentType === 'film' ? 'Film' : 'TV Show'}
                            {media.year && ` (${media.year})`}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Media Details */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        {media.duration && (
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            {media.duration}
                          </div>
                        )}
                        {media.contentType === 'tv_show' && media.seasonNumber && (
                          <div className="flex items-center">
                            <Tv className="h-4 w-4 mr-2" />
                            {media.seasonNumber} Season{media.seasonNumber > 1 ? 's' : ''}
                            {media.totalEpisodes && ` • ${media.totalEpisodes} Episodes`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Playlist Information */}
                  {media.playlist && (
                    <div className="pt-4 border-t border-gray-700">
                      <p className="text-sm text-gray-400">
                        <span className="text-white font-medium">Playlist:</span> {media.playlist.name}
                        {media.playlist.description && (
                          <span className="ml-2 text-gray-500">• {media.playlist.description}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400">Media information not available</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}