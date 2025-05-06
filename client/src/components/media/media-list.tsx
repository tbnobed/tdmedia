import { Media } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { getMediaTypeColor, getMediaMetadata, getMediaActionText, getMediaActionIcon } from "@/lib/media-utils";
import * as LucideIcons from "lucide-react";

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
            <LucideIcons.FileQuestion className="h-8 w-8 text-gray-400" />
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
          const ActionIcon = LucideIcons[getMediaActionIcon(item.type) as keyof typeof LucideIcons];
          
          return (
            <li key={item.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 bg-gray-100 rounded overflow-hidden mr-4">
                  {item.thumbnailUrl ? (
                    <img 
                      src={item.thumbnailUrl} 
                      alt={item.title} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <LucideIcons.File className="h-8 w-8 text-gray-400" />
                    </div>
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
                    <ActionIcon className="mr-1 h-4 w-4" /> {getMediaActionText(item.type)}
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
