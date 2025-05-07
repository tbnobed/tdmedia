import { Media } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { getMediaTypeColor, getMediaMetadata, getMediaActionText } from "@/lib/media-utils";
import { 
  FileQuestion, 
  FileText, 
  Image as ImageIcon, 
  Presentation, 
  PlayCircle, 
  File,
  Play,
  Eye,
  ArrowRight,
  Calendar,
  Clock,
  FileType
} from "lucide-react";

interface MediaGridProps {
  media: Media[];
  onOpenMedia: (media: Media) => void;
}

export default function MediaGrid({ media, onOpenMedia }: MediaGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {media.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center py-12">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-6 mb-6">
            <FileQuestion className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-gray-100">No media found</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
            Try adjusting your search or filter criteria to find what you're looking for
          </p>
        </div>
      ) : (
        media.map((item) => {
          const typeColor = getMediaTypeColor(item.type);
          
          // Get the appropriate icon components based on media type
          let TypeIcon = FileText;
          if (item.type === 'video') TypeIcon = PlayCircle;
          else if (item.type === 'image') TypeIcon = ImageIcon;
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
              className="overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300 border-gray-200 dark:border-gray-800"
            >
              <div 
                className="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer"
                onClick={() => onOpenMedia(item)}
              >
                {/* Thumbnail or placeholder */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <TypeIcon className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                </div>
                
                {item.thumbnailUrl && (
                  <img 
                    src={item.thumbnailUrl} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                  />
                )}
                
                {/* Overlay with play/view button */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-white/90 hover:bg-white text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMedia(item);
                    }}
                  >
                    <ActionIcon className="mr-1 h-4 w-4" />
                    {getMediaActionText(item.type)}
                  </Button>
                </div>
                
                {/* Type badge */}
                <div className="absolute top-2 left-2">
                  <span 
                    className={`px-2 py-1 text-xs font-medium rounded-full shadow-sm
                      ${typeColor.bg} ${typeColor.text}
                    `}
                  >
                    {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="p-4 flex-grow">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {item.description || "No description available"}
                </p>
                
                {/* Metadata */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.duration && (
                    <div className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3 mr-1" />
                      {item.duration}
                    </div>
                  )}
                  {item.size && (
                    <div className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <FileType className="h-3 w-3 mr-1" />
                      {item.size}
                    </div>
                  )}
                  {item.createdAt && (
                    <div className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3 w-3 mr-1" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              
              <CardFooter className="border-t border-gray-100 dark:border-gray-800 pt-3 pb-4 px-4">
                <Button 
                  className="w-full"
                  onClick={() => onOpenMedia(item)}
                >
                  {typeof ActionIcon === 'function' && <ActionIcon className="mr-2 h-4 w-4" />}{' '}
                  {getMediaActionText(item.type)}
                </Button>
              </CardFooter>
            </Card>
          );
        })
      )}
    </div>
  );
}
