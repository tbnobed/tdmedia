import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Media, Playlist, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import VideoPlayer from "@/components/media/video-player";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, Plus, Search, FileText, Video, Image, Presentation, Eye, UserCheck, Loader2 } from "lucide-react";
import AddMediaForm from "./add-media-form";
import EditMediaForm from "./edit-media-form";
import MediaPreview from "./media-preview";

export default function MediaManagement() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>("");

  // Fetch all media
  const { data: media, isLoading } = useQuery<Media[]>({
    queryKey: ["/api/media"],
  });
  
  // Fetch all playlists
  const { data: playlists } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
  });
  
  // Fetch all client users (non-admin)
  const {
    data: clients,
    isLoading: isLoadingClients,
  } = useQuery<User[]>({
    queryKey: ["/api/users/clients"],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: assignDialogOpen, // Only fetch when assign dialog is open
  });

  // Delete media mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/media/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({
        title: "Media deleted",
        description: "The media item has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete media: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Generate thumbnail mutation
  const thumbnailMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/media/${id}/thumbnail`);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/media"] });
      toast({
        title: "Thumbnail generated",
        description: "The thumbnail has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to generate thumbnail: ${error.message}`,
        variant: "destructive",
      });
    },
  });
  
  // Assign media to user mutation
  const assignMediaMutation = useMutation({
    mutationFn: async ({ mediaId, userId }: { mediaId: number, userId: number }) => {
      const response = await apiRequest("POST", "/api/media-access", {
        mediaId,
        userId,
      });
      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate both media access and the specific user's media cache
      queryClient.invalidateQueries({ queryKey: ["/api/media-access"] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${variables.userId}/media`] });
      
      toast({
        title: "Media assigned",
        description: "The media has been assigned to the user successfully.",
      });
      // Reset form and close dialog
      setSelectedUser("");
      setAssignDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error assigning media",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle edit media
  const handleEditMedia = (media: Media) => {
    setSelectedMedia(media);
    setEditDialogOpen(true);
  };

  // Handle delete media
  const handleDeleteMedia = (media: Media) => {
    setSelectedMedia(media);
    setDeleteDialogOpen(true);
  };
  
  // Handle thumbnail generation
  const handleGenerateThumbnail = (id: number) => {
    thumbnailMutation.mutate(id);
  };
  
  // Handle preview media
  const handlePreviewMedia = (media: Media) => {
    setSelectedMedia(media);
    setPreviewDialogOpen(true);
  };
  
  // Handle assign media
  const handleAssignMedia = (media: Media) => {
    setSelectedMedia(media);
    setSelectedUser("");
    setAssignDialogOpen(true);
  };
  
  // Handle confirm assign
  const confirmAssign = () => {
    if (selectedMedia && selectedUser) {
      assignMediaMutation.mutate({
        mediaId: selectedMedia.id,
        userId: parseInt(selectedUser, 10),
      });
    }
  };

  // Confirm delete
  const confirmDelete = () => {
    if (selectedMedia) {
      deleteMutation.mutate(selectedMedia.id);
    }
  };

  // Filter media by search term
  const filteredMedia = media?.filter(item => 
    item.title.toLowerCase().includes(search.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(search.toLowerCase()))
  );

  // Get icon for media type
  const getMediaTypeIcon = (type: string) => {
    switch(type) {
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'presentation':
        return <Presentation className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold">Media Library Management</h2>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add New Media
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search media..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Playlist</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMedia && filteredMedia.length > 0 ? (
                filteredMedia.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="font-medium">{item.title}</div>
                        {item.type === 'video' && (
                          <div className="w-full max-w-[160px] h-24 bg-gray-100 rounded-md overflow-hidden">
                            <VideoPlayer mediaId={item.id} controls={false} muted={true} small={true} showWatermark={false} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getMediaTypeIcon(item.type)}
                        <span className="capitalize">{item.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {playlists?.find(playlist => playlist.id === item.playlistId)?.name || 'Uncategorized'}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-blue-600 hover:text-blue-800"
                          title="View Media"
                          onClick={() => handlePreviewMedia(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEditMedia(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {item.type === 'video' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleGenerateThumbnail(item.id)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Generate thumbnail"
                          >
                            <Image className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-green-600 hover:text-green-800"
                          title="Assign to User"
                          onClick={() => handleAssignMedia(item)}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="text-destructive hover:text-destructive" 
                          onClick={() => handleDeleteMedia(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No media found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add Media Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Media</DialogTitle>
            <DialogDescription>
              Add a new media item to the library. Fill out the details below.
            </DialogDescription>
          </DialogHeader>
          <AddMediaForm onComplete={() => setAddDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit Media Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Media</DialogTitle>
            <DialogDescription>
              Update the media item details.
            </DialogDescription>
          </DialogHeader>
          {selectedMedia && (
            <EditMediaForm 
              media={selectedMedia} 
              onComplete={() => setEditDialogOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the media item
              "{selectedMedia?.title}" from the library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Media Preview */}
      <MediaPreview 
        media={selectedMedia}
        isOpen={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
      />
      
      {/* Assign Media to User Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Media to User</DialogTitle>
            <DialogDescription>
              Select a user to assign "{selectedMedia?.title}" to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-6">
            <div className="space-y-4">
              {isLoadingClients ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : clients && clients.length > 0 ? (
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.username} ({client.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No client users found. Please create a client user first.
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmAssign}
              disabled={!selectedUser || assignMediaMutation.isPending}
            >
              {assignMediaMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
