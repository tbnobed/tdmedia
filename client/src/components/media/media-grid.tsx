import { Media } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getMediaTypeColor, getMediaTypeIcon, getMediaMetadata, getMediaActionText, getMediaActionIcon } from "@/lib/media-utils";
import { LucideIcon } from "lucide-react";
import * as LucideIcons from "lucide-react";

interface MediaGridProps {
  media: Media[];
  onOpenMedia: (media: Media) => void;
}

export default function MediaGrid({ media, onOpenMedia }: MediaGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {media.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-12">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <LucideIcons.FileQuestion className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No media found</h3>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        media.map((item) => {
          const typeColor = getMediaTypeColor(item.type);
          const IconComponent = LucideIcons[getMediaTypeIcon(item.type) as keyof typeof LucideIcons] as LucideIcon;
          const ActionIcon = LucideIcons[getMediaActionIcon(item.type) as keyof typeof LucideIcons] as LucideIcon;
          
          return (
            <Card key={item.id} className="overflow-hidden flex flex-col">
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <IconComponent className="h-10 w-10 text-gray-400" />
                </div>
                {item.thumbnailUrl && (
                  <img 
                    src={item.thumbnailUrl} 
                    alt={item.title} 
                    className="w-full h-full object-cover" 
                  />
                )}
              </div>
              
              <div className="p-4 flex-grow">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColor.bg} ${typeColor.text}`}>
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </span>
                  <span className="text-xs text-gray-500">{getMediaMetadata(item)}</span>
                </div>
                <h3 className="mt-2 text-lg font-medium text-gray-900">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>
              </div>
              
              <div className="border-t border-gray-200 p-4">
                <Button 
                  className="w-full"
                  onClick={() => onOpenMedia(item)}
                >
                  <ActionIcon className="mr-2 h-4 w-4" />
                  {getMediaActionText(item.type)}
                </Button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
