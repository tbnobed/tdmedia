import { Media } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  getMediaTypeColor, 
  getMediaMetadata, 
  getMediaActionText,
  getContentClassification 
} from "@/lib/media-utils";
import { 
  FileQuestion, 
  FileText, 
  Image, 
  Presentation, 
  PlayCircle, 
  File,
  Play,
  Eye,
  ArrowRight
} from "lucide-react";

interface MediaGridProps {
  media: Media[];
  onOpenMedia: (media: Media) => void;
}

export default function MediaGrid({ media, onOpenMedia }: MediaGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4 lg:gap-6">
      {media.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-8 sm:py-12">
          <div className="bg-gray-100 rounded-full p-4 mb-4">
            <FileQuestion className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No media found</h3>
          <p className="mt-1 text-sm text-gray-500 text-center px-4">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        media.map((item) => {
          const typeColor = getMediaTypeColor(item.type);
          
          // Get the appropriate icon components based on media type
          let TypeIcon = FileText;
          if (item.type === 'video') TypeIcon = PlayCircle;
          else if (item.type === 'image') TypeIcon = Image;
          else if (item.type === 'presentation') TypeIcon = Presentation;
          else if (item.type === 'document') TypeIcon = FileText;
          else TypeIcon = File;
          
          // Get the appropriate action icon based on media type
          let ActionIcon = Eye;
          if (item.type === 'video') ActionIcon = Play;
          else if (['document', 'image', 'presentation'].includes(item.type)) ActionIcon = Eye;
          else ActionIcon = ArrowRight;
          
          return (
            <Card 
              key={item.id} 
              className="overflow-hidden flex flex-col transition-all duration-300 hover:translate-y-[-4px] hover:shadow-xl hover:shadow-gray-900/50 shadow-md shadow-gray-800/20"
            >
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <TypeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
                </div>
                {item.thumbnailUrl && (
                  <img 
                    src={item.thumbnailUrl} 
                    alt={item.title} 
                    className="w-full h-full object-cover" 
                    loading="lazy"
                  />
                )}
                <div 
                  className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-center"
                  onClick={() => onOpenMedia(item)}
                >
                  <Button 
                    className="mb-4 bg-gradient-to-r from-black to-gray-800 hover:from-gray-900 hover:to-gray-700 text-white shadow-lg"
                    size="sm"
                  >
                    {typeof ActionIcon === 'function' && <ActionIcon className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />}{' '}
                    {getMediaActionText(item.type)}
                  </Button>
                </div>
              </div>
              
              <div className="p-3 sm:p-4 flex-grow">
                <div className="flex items-center justify-end">
                  <span className="text-xs text-gray-500">{getMediaMetadata(item)}</span>
                </div>
                <h3 className="mt-2 text-base sm:text-lg font-medium text-gray-900">{item.title}</h3>
                
                {/* Content Classification */}
                {getContentClassification(item) && (
                  <div className="mt-1 text-xs text-blue-600 font-medium">
                    {getContentClassification(item)}
                  </div>
                )}
                
                <p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-2">{item.description}</p>
              </div>
              
              <div className="border-t border-gray-200 p-3 sm:p-4">
                <Button 
                  className="w-full shadow-sm hover:shadow transition-shadow bg-gradient-to-r from-black to-gray-800 hover:from-gray-900 hover:to-gray-700 text-white text-xs sm:text-sm h-8 sm:h-10"
                  onClick={() => onOpenMedia(item)}
                >
                  {typeof ActionIcon === 'function' && <ActionIcon className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />}{' '}
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
