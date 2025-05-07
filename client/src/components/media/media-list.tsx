import { Media } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { getMediaTypeColor, getMediaMetadata, getMediaActionText, getMediaActionIcon } from "@/lib/media-utils";
import { Play, Eye, ArrowRight, File, FileQuestion } from "lucide-react";

interface MediaListProps {
  media: Media[];
  onOpenMedia: (media: Media) => void;
}

export default function MediaList({ media, onOpenMedia }: MediaListProps) {
  if (media.length === 0) {
    return (
      <div className="bg-white rounded-md shadow overflow-hidden">
        <div className="flex flex-col items-center justify-center py-8 sm:py-12">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <FileQuestion className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No media found</h3>
          <p className="mt-1 text-sm text-gray-500 text-center px-4">Try adjusting your search or filter criteria</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white shadow overflow-hidden rounded-md">
      <ul className="divide-y divide-gray-200">
        {media.map((item) => {
          const typeColor = getMediaTypeColor(item.type);
          const actionIconName = getMediaActionIcon(item.type);
          
          // Determine which icon to use
          let ActionIcon = ArrowRight;
          if (actionIconName === 'play') {
            ActionIcon = Play;
          } else if (actionIconName === 'eye') {
            ActionIcon = Eye;
          }
          
          return (
            <li key={item.id} className="hover:bg-gray-50 transition-colors">
              <div className="px-3 py-3 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center">
                {/* Thumbnail with overlay for mobile tap */}
                <div className="relative w-full sm:w-20 h-32 sm:h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden sm:mr-4 mb-2 sm:mb-0">
                  {item.thumbnailUrl ? (
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.title} 
                      className="w-full h-full object-cover" 
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <File className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div 
                    className="sm:hidden absolute inset-0 bg-black/10 flex items-center justify-center"
                    onClick={() => onOpenMedia(item)}
                  >
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-700 hover:bg-green-800 text-white shadow-lg"
                    >
                      <ActionIcon className="mr-1 h-4 w-4" />
                      {getMediaActionText(item.type)}
                    </Button>
                  </div>
                </div>
                
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColor.bg} ${typeColor.text}`}>
                      {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">{getMediaMetadata(item)}</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate mt-1">{item.title}</h3>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2 sm:line-clamp-1">{item.description}</p>
                </div>
                
                {/* Action Button - Hidden on mobile, shown on desktop */}
                <div className="hidden sm:block ml-4 flex-shrink-0">
                  <Button
                    variant="default"
                    size="sm"
                    className="bg-green-700 hover:bg-green-800 text-white h-8 sm:h-9"
                    onClick={() => onOpenMedia(item)}
                  >
                    <ActionIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="text-xs sm:text-sm">{getMediaActionText(item.type)}</span>
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
