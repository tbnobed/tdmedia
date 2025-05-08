import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMediaSchema, Media } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, FileText, FileImage, Video, PresentationIcon, Check, AlertTriangle } from "lucide-react";

// Media form schema based on the insertMediaSchema but extended for UI needs
const mediaFormSchema = insertMediaSchema.extend({
  playlistIds: z.array(z.number()).default([])
});

type MediaFormValues = z.infer<typeof mediaFormSchema>;

interface EditMediaFormProps {
  media: Media;
  onComplete: () => void;
}

export default function EditMediaForm({ media, onComplete }: EditMediaFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string;
    thumbnailUrl?: string;
    type: string;
    size: string;
    duration?: string;
  } | null>(null);
  const [uploadThumbnailProgress, setUploadThumbnailProgress] = useState(0);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [uploadThumbnailError, setUploadThumbnailError] = useState<string | null>(null);
  const [uploadedThumbnail, setUploadedThumbnail] = useState<{
    thumbnailUrl: string;
  } | null>(null);
  
  // Media types for select dropdown
  const mediaTypes = [
    { value: "video", label: "Video" },
    { value: "document", label: "Document" },
    { value: "image", label: "Image" },
    { value: "presentation", label: "Presentation" },
  ];
  
  // Fetch playlists for select dropdown
  const { data: playlists = [] } = useQuery<{id: number, name: string}[]>({
    queryKey: ["/api/playlists"],
  });
  
  // Fetch existing playlist associations for this media
  const { data: mediaPlaylists = [], isLoading: isLoadingPlaylists } = useQuery<{mediaId: number, playlistId: number, playlistName: string}[]>({
    queryKey: ["/api/media", media.id, "playlists"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/media/${media.id}/playlists`);
        const data = await res.json();
        console.log(`Fetched playlists for media ${media.id}:`, data);
        return data;
      } catch (error) {
        console.error(`Error fetching playlists for media ${media.id}:`, error);
        return [];
      }
    }
  });

  // Extract playlist IDs from the media's playlist associations
  const existingPlaylistIds = mediaPlaylists.map(mp => mp.playlistId);
  console.log("Existing playlist IDs:", existingPlaylistIds);

  // Edit media form
  const form = useForm<MediaFormValues>({
    resolver: zodResolver(mediaFormSchema),
    defaultValues: {
      title: media.title,
      description: media.description || "",
      type: media.type,
      playlistIds: [], // Will be updated in useEffect
      fileUrl: media.fileUrl,
      thumbnailUrl: media.thumbnailUrl || "",
      duration: media.duration || "",
      size: media.size || "",
    },
  });
  
  // Update playlistIds when mediaPlaylists data changes
  useEffect(() => {
    if (!isLoadingPlaylists && mediaPlaylists.length > 0) {
      const playlistIds = mediaPlaylists.map(mp => mp.playlistId);
      console.log("Setting playlist IDs in form:", playlistIds);
      form.setValue('playlistIds', playlistIds);
    }
  }, [mediaPlaylists, isLoadingPlaylists, form]);
  
  // Update media mutation
  const updateMediaMutation = useMutation({
    mutationFn: async (values: MediaFormValues) => {
      const res = await apiRequest("PUT", `/api/media/${media.id}`, values);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({
        title: "Media updated",
        description: "The media item has been updated successfully.",
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update media: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Watch the type field to dynamically update file validation
  const mediaType = form.watch("type");
  
  // Upload file mutation with robust large file handling
  const uploadFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      try {
        // For large file upload, use XMLHttpRequest to track progress
        const file = formData.get('file') as File;
        
        if (file.size > 100 * 1024 * 1024) { // If file is larger than 100MB
          console.log(`Large file detected (${Math.round(file.size / (1024 * 1024))}MB), using chunked upload...`);
          
          // For very large files, we'll show a warning first
          if (file.size > 400 * 1024 * 1024) {
            toast({
              title: "Large file detected",
              description: "Files over 400MB may take a long time to upload. Please be patient.",
              duration: 6000,
            });
          }
        }
        
        return new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Set up progress tracking
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percentComplete);
            }
          });
          
          // Handle response
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch (error) {
                reject(new Error('Invalid response from server'));
              }
            } else {
              reject(new Error(xhr.responseText || `Upload failed: ${xhr.status}`));
            }
          };
          
          // Handle network errors
          xhr.onerror = () => {
            reject(new Error('Network error during upload'));
          };
          
          // Handle timeouts - set a long timeout for large files
          xhr.timeout = 30 * 60 * 1000; // 30 minutes
          xhr.ontimeout = () => {
            reject(new Error('Upload timed out - file may be too large'));
          };
          
          // Send the request
          xhr.open('POST', '/api/upload', true);
          xhr.withCredentials = true;
          xhr.send(formData);
        });
      } catch (error) {
        console.error('Upload error:', error);
        throw error instanceof Error ? error : new Error('Unknown upload error');
      }
    },
    onSuccess: (data) => {
      setUploadedFile(data);
      setUploadProgress(100);
      
      // Update form fields with file data
      form.setValue("fileUrl", data.fileUrl);
      if (data.thumbnailUrl) {
        form.setValue("thumbnailUrl", data.thumbnailUrl);
      }
      form.setValue("size", data.size);
      if (data.duration) {
        form.setValue("duration", data.duration);
      }
      if (data.type) {
        form.setValue("type", data.type);
      }
      
      toast({
        title: "File uploaded",
        description: "Your file has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      setUploadError(error.message);
      setUploadProgress(0);
      setIsUploading(false);
      
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });
  
  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);
    
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', mediaType); // Pass the selected media type
    
    // Progress is now tracked by the XMLHttpRequest in the mutation function
    
    // Upload the file
    uploadFileMutation.mutate(formData);
  };
  
  // Prompt user to select a file
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  // Upload thumbnail mutation with progress tracking
  const uploadThumbnailMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      try {
        return new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Set up progress tracking
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setUploadThumbnailProgress(percentComplete);
            }
          });
          
          // Handle response
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch (error) {
                reject(new Error('Invalid response from server'));
              }
            } else {
              reject(new Error(xhr.responseText || `Upload failed: ${xhr.status}`));
            }
          };
          
          // Handle network errors
          xhr.onerror = () => {
            reject(new Error('Network error during upload'));
          };
          
          // Handle timeouts
          xhr.timeout = 5 * 60 * 1000; // 5 minutes
          xhr.ontimeout = () => {
            reject(new Error('Upload timed out'));
          };
          
          // Send the request
          xhr.open('POST', `/api/media/${media.id}/thumbnail`, true);
          xhr.withCredentials = true;
          xhr.send(formData);
        });
      } catch (error) {
        console.error('Thumbnail upload error:', error);
        throw error instanceof Error ? error : new Error('Unknown upload error');
      }
    },
    onSuccess: (data) => {
      // Make sure data has the correct structure before setting it
      const thumbnailData = {
        thumbnailUrl: data.thumbnailUrl || data.url || ""
      };
      setUploadedThumbnail(thumbnailData);
      setUploadThumbnailProgress(100);
      
      // Update form field with thumbnail URL using the correct property
      form.setValue("thumbnailUrl", thumbnailData.thumbnailUrl);
      
      toast({
        title: "Thumbnail uploaded",
        description: "Your thumbnail has been uploaded successfully.",
      });
      
      // Invalidate the media query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
    },
    onError: (error: Error) => {
      setUploadThumbnailError(error.message);
      setUploadThumbnailProgress(0);
      setIsUploadingThumbnail(false);
      
      toast({
        title: "Thumbnail upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsUploadingThumbnail(false);
    }
  });
  
  // Handle thumbnail file selection
  const handleThumbnailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadThumbnailError(null);
    setIsUploadingThumbnail(true);
    setUploadThumbnailProgress(0);
    
    // Create a FormData object to send the thumbnail
    const formData = new FormData();
    formData.append('file', file);
    
    // Upload the thumbnail
    uploadThumbnailMutation.mutate(formData);
  };
  
  // Prompt user to select a thumbnail
  const handleThumbnailUploadClick = () => {
    thumbnailInputRef.current?.click();
  };
  
  // Form submission handler
  const onSubmit = (values: MediaFormValues) => {
    // Add debug logs to see what's being sent
    console.log("Submitting media update with values:", values);
    console.log("Playlist IDs being sent:", values.playlistIds);
    
    // If the thumbnailUrl is empty but we have an uploaded thumbnail, use that instead
    if (!values.thumbnailUrl && uploadedThumbnail?.thumbnailUrl) {
      values.thumbnailUrl = uploadedThumbnail.thumbnailUrl;
    }
    
    // If thumbnailUrl is still empty but media has one, preserve the original
    if (!values.thumbnailUrl && media.thumbnailUrl) {
      values.thumbnailUrl = media.thumbnailUrl;
    }
    
    console.log("Final submission values with thumbnailUrl:", values);
    updateMediaMutation.mutate(values);
  };
  
  // No duplicate useEffect needed as we already have one that sets playlistIds
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Media title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Media description" 
                  {...field} 
                  value={field.value || ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select media type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mediaTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="playlistIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Playlists</FormLabel>
                <div className="relative">
                  <Select
                    onValueChange={(value) => {
                      const id = parseInt(value, 10);
                      // Ensure field.value is always an array
                      const currentValues = Array.isArray(field.value) ? field.value : [];
                      // Add the id if it's not already in the array
                      if (!currentValues.includes(id)) {
                        field.onChange([...currentValues, id]);
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select playlists" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {playlists?.map((playlist) => (
                        <SelectItem 
                          key={playlist.id} 
                          value={playlist.id.toString()}
                          disabled={Array.isArray(field.value) && field.value.includes(playlist.id)}
                        >
                          {playlist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Display selected playlists with remove option */}
                {Array.isArray(field.value) && field.value.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {field.value.map((playlistId) => {
                      const playlist = playlists?.find(p => p.id === playlistId);
                      return playlist ? (
                        <Badge key={playlistId} variant="outline" className="flex items-center gap-1">
                          {playlist.name}
                          <button
                            type="button"
                            className="ml-1 rounded-full w-4 h-4 inline-flex items-center justify-center text-slate-400 hover:text-slate-500"
                            onClick={() => {
                              const currentValues = Array.isArray(field.value) ? field.value : [];
                              field.onChange(currentValues.filter(id => id !== playlistId));
                            }}
                          >
                            ×
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        {/* File Upload Section */}
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-medium">Replace Media File</h3>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept={
              mediaType === 'image' ? 'image/*' :
              mediaType === 'video' ? 'video/*' :
              mediaType === 'document' ? '.pdf,.doc,.docx,.txt,.rtf' :
              '.ppt,.pptx,.key,.odp'
            }
          />
          
          <div 
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isUploading || uploadedFile 
                ? 'border-slate-300 dark:border-slate-700' 
                : 'border-slate-300 dark:border-slate-700 hover:border-primary hover:dark:border-primary'}
            `}
            onClick={handleUploadClick}
          >
            {uploadedFile ? (
              <div className="flex flex-col items-center space-y-2 text-slate-700 dark:text-slate-300">
                <Check className="h-10 w-10 text-green-500" />
                <p className="text-sm">File successfully uploaded</p>
                <p className="text-xs text-slate-500">{uploadedFile.fileUrl.split('/').pop()}</p>
                <p className="text-xs text-slate-500">{uploadedFile.size}</p>
              </div>
            ) : isUploading ? (
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Uploading file...</p>
                <Progress value={uploadProgress} className="w-full max-w-xs" />
                <p className="text-xs text-slate-500">{uploadProgress}%</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                {mediaType === 'video' && <Video className="h-10 w-10 text-slate-400" />}
                {mediaType === 'image' && <FileImage className="h-10 w-10 text-slate-400" />}
                {mediaType === 'document' && <FileText className="h-10 w-10 text-slate-400" />}
                {mediaType === 'presentation' && <PresentationIcon className="h-10 w-10 text-slate-400" />}
                <p className="text-sm">Drag and drop or click to upload a new file</p>
                <p className="text-xs text-slate-500">
                  {mediaType === 'image' ? 'JPG, PNG, GIF or WebP' :
                   mediaType === 'video' ? 'MP4, WebM or MOV' :
                   mediaType === 'document' ? 'PDF, DOC, DOCX or TXT' :
                   'PPT, PPTX or ODP'}
                </p>
                <p className="text-xs text-slate-400">Current file: {media.fileUrl.split('/').pop()}</p>
              </div>
            )}
          </div>
          
          {uploadError && (
            <div className="flex items-center space-x-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <p>{uploadError}</p>
            </div>
          )}
        </div>

        <FormField
          control={form.control}
          name="fileUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>File URL</FormLabel>
              <FormControl>
                <Input placeholder="/media/file.ext" {...field} />
              </FormControl>
              <FormDescription>
                This field will be automatically updated when you upload a new file.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Thumbnail Upload Section */}
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-medium">Thumbnail Image</h3>
          
          <input
            type="file"
            ref={thumbnailInputRef}
            onChange={handleThumbnailChange}
            className="hidden"
            accept="image/*"
          />
          
          <div 
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors duration-200
              ${isUploadingThumbnail || uploadedThumbnail 
                ? 'border-slate-300 dark:border-slate-700' 
                : 'border-slate-300 dark:border-slate-700 hover:border-primary hover:dark:border-primary'}
            `}
            onClick={handleThumbnailUploadClick}
          >
            {uploadedThumbnail ? (
              <div className="flex flex-col items-center space-y-2 text-slate-700 dark:text-slate-300">
                <Check className="h-8 w-8 text-green-500" />
                <p className="text-sm">Thumbnail uploaded successfully</p>
                <p className="text-xs text-slate-500">{uploadedThumbnail.thumbnailUrl.split('/').pop()}</p>
                <div className="mt-2 max-w-[150px] max-h-[150px] overflow-hidden">
                  <img 
                    src={uploadedThumbnail.thumbnailUrl} 
                    alt="Thumbnail preview" 
                    className="w-full h-auto object-cover rounded"
                  />
                </div>
              </div>
            ) : isUploadingThumbnail ? (
              <div className="flex flex-col items-center space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Uploading thumbnail...</p>
                <Progress value={uploadThumbnailProgress} className="w-full max-w-xs" />
                <p className="text-xs text-slate-500">{uploadThumbnailProgress}%</p>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-2">
                <FileImage className="h-8 w-8 text-slate-400" />
                <p className="text-sm">Click to upload a new thumbnail image</p>
                <p className="text-xs text-slate-500">JPG, PNG, GIF or WebP</p>
                {media.thumbnailUrl && (
                  <>
                    <p className="text-xs text-slate-400">Current thumbnail: {media.thumbnailUrl.split('/').pop()}</p>
                    <div className="mt-2 max-w-[150px] max-h-[150px] overflow-hidden">
                      <img 
                        src={media.thumbnailUrl} 
                        alt="Current thumbnail" 
                        className="w-full h-auto object-cover rounded"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {uploadThumbnailError && (
            <div className="flex items-center space-x-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <p>{uploadThumbnailError}</p>
            </div>
          )}
        </div>
        
        <FormField
          control={form.control}
          name="thumbnailUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Thumbnail URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/thumb.jpg" {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>
                This field will be automatically updated when you upload a thumbnail.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="duration"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duration (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 5:32" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 23 pages, 15MB" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onComplete}
            disabled={updateMediaMutation.isPending}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            disabled={updateMediaMutation.isPending}
          >
            {updateMediaMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...
              </>
            ) : (
              "Update Media"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
