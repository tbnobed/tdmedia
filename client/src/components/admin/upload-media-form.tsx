import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { insertMediaSchema, mediaTypeEnum } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud } from 'lucide-react';

// Create a form schema based on the media schema, but make fileUrl optional
const uploadMediaSchema = z.object({
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  type: z.enum(mediaTypeEnum.enumValues),
  categoryId: z.coerce.number().int().positive("Category is required"),
  fileUrl: z.string().optional(), // Will be filled in by the file upload
  file: z.instanceof(File, { message: "Please select a file to upload" })
});

type UploadMediaFormValues = z.infer<typeof uploadMediaSchema>;

interface UploadMediaFormProps {
  categories: Array<{ id: number; name: string }>;
  onComplete: () => void;
}

export default function UploadMediaForm({ categories, onComplete }: UploadMediaFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  
  const form = useForm<UploadMediaFormValues>({
    resolver: zodResolver(uploadMediaSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'document',
      categoryId: undefined,
      fileUrl: '',
    }
  });
  
  // Step 1: Upload file
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload file');
      }
      
      return await response.json();
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsUploading(false);
    }
  });
  
  // Step 2: Create media record with file information
  const createMediaMutation = useMutation({
    mutationFn: async (values: z.infer<typeof insertMediaSchema>) => {
      const res = await apiRequest('POST', '/api/media', values);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: 'Media uploaded',
        description: 'The media has been uploaded successfully',
      });
      form.reset();
      setIsUploading(false);
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create media record',
        description: error.message,
        variant: 'destructive',
      });
      setIsUploading(false);
    }
  });
  
  const onSubmit = async (values: UploadMediaFormValues) => {
    setIsUploading(true);
    
    try {
      // First upload the file
      const fileData = await uploadFileMutation.mutateAsync(values.file);
      
      // Then create media record with file info
      await createMediaMutation.mutateAsync({
        title: values.title,
        description: values.description,
        type: values.type,
        categoryId: values.categoryId,
        fileUrl: fileData.filePath // Use the path returned from the server
      });
    } catch (error) {
      // Error already handled by mutations
      console.error('Upload process failed:', error);
    }
  };
  
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Upload New Media</CardTitle>
        <CardDescription>
          Add a new media item to the Trilogy Digital Media library.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter media title" {...field} />
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
                      placeholder="Enter a detailed description" 
                      {...field} 
                      rows={3}
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
                    <FormLabel>Media Type</FormLabel>
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
                        <SelectItem value="document">Document</SelectItem>
                        <SelectItem value="image">Image</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="presentation">Presentation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="file"
              render={({ field: { onChange, value, ...rest } }) => (
                <FormItem>
                  <FormLabel>Media File</FormLabel>
                  <FormControl>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center">
                      <UploadCloud className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        Drag and drop or click to upload
                      </p>
                      <Input
                        type="file"
                        className="hidden"
                        id="file-upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            onChange(file);
                          }
                        }}
                        {...rest}
                      />
                      <label htmlFor="file-upload">
                        <div className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded cursor-pointer">
                          Select File
                        </div>
                      </label>
                      {value && (
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          Selected: {(value as File).name}
                        </p>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Supported file types: images, documents, presentations, and videos.
                    Maximum file size: 50MB.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full"
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload Media'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <Button variant="outline" onClick={onComplete}>
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}