import { Media } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { getMediaTypeColor, getMediaMetadata, getMediaActionText } from "@/lib/media-utils";
import VideoPlayer from "@/components/media/video-player";
import { FileQuestion, Play, Eye, FileText, Presentation, File } from "lucide-react";

interface MediaListProps {
  media: Media[];
  onOpenMedia: (media: Media) => void;
}

export default function MediaList({ media, onOpenMedia }: MediaListProps) {
  if (media.length === 0) {
    return (
      <div className="bg-white rounded-md shadow overflow-hidden">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <FileQuestion className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No media found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {media.map((item) => {
          const typeColor = getMediaTypeColor(item.type);
          
          return (
            <li key={item.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden mr-4">
                  {item.type === 'video' ? (
                    item.thumbnailUrl ? (
                      <div className="relative">
                        <img 
                          src={`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}/${item.thumbnailUrl?.startsWith('/') ? item.thumbnailUrl.substring(1) : item.thumbnailUrl}`}
                          alt={item.title} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            console.error("Error loading thumbnail:", item.thumbnailUrl);
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black bg-opacity-30 rounded-full p-2">
                            <Play className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <VideoPlayer 
                        mediaId={item.id} 
                        controls={false} 
                        muted={true} 
                        small={true} 
                        autoPlay={false} 
                      />
                    )
                  ) : (
                    item.thumbnailUrl ? (
                      <img 
                        src={`${window.TRILOGY_CONFIG?.apiBaseUrl || ''}/${item.thumbnailUrl?.startsWith('/') ? item.thumbnailUrl.substring(1) : item.thumbnailUrl}`}
                        alt={item.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error("Error loading thumbnail:", item.thumbnailUrl);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <File className="h-8 w-8 text-gray-400" />
                      </div>
                    )
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex items-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColor.bg} ${typeColor.text}`}>
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">{getMediaMetadata(item)}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{item.title}</h3>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 hidden sm:block line-clamp-1">{item.description}</p>
                </div>
                
                <div className="ml-4 flex-shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onOpenMedia(item)}
                  >
                    {item.type === 'video' && <Play className="mr-1 h-4 w-4" />}
                    {item.type === 'image' && <Eye className="mr-1 h-4 w-4" />}
                    {item.type === 'document' && <FileText className="mr-1 h-4 w-4" />}
                    {item.type === 'presentation' && <Presentation className="mr-1 h-4 w-4" />}
                    {getMediaActionText(item.type)}
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
