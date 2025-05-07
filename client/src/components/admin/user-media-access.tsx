import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogClose
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Loader2, 
  UserCheck, 
  Users, 
  FileText, 
  Plus, 
  Trash2, 
  PlayCircle, 
  Image, 
  File, 
  Presentation 
} from "lucide-react";

interface User {
  id: number;
  username: string;
  email: string;
}

interface Media {
  id: number;
  title: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
}

interface MediaAccess {
  id: number;
  mediaId: number;
  userId: number;
  createdAt: string;
  createdById: number;
  media: Media;
}

export default function UserMediaAccess() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<number | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  // Check for pre-selected client ID from localStorage when component mounts
  useEffect(() => {
    const storedClientId = localStorage.getItem('selectedClientId');
    if (storedClientId) {
      setSelectedUser(parseInt(storedClientId));
      // Clear it after use to avoid unexpected selections on future loads
      localStorage.removeItem('selectedClientId');
    }
  }, []);

  // Query for all client users (non-admin)
  const {
    data: clients,
    isLoading: isLoadingClients,
    error: clientsError,
  } = useQuery<User[]>({
    queryKey: ["/api/users/clients"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Query for all media
  const {
    data: allMedia,
    isLoading: isLoadingMedia,
    error: mediaError,
  } = useQuery<Media[]>({
    queryKey: ["/api/media"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Query for user's assigned media
  const {
    data: userMedia,
    isLoading: isLoadingUserMedia,
    error: userMediaError,
  } = useQuery<MediaAccess[]>({
    queryKey: [`/api/users/${selectedUser}/media`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedUser,
  });

  // Mutation to assign media to a user
  const assignMediaMutation = useMutation({
    mutationFn: async ({ mediaId, userId }: { mediaId: number; userId: number }) => {
      const response = await apiRequest("POST", "/api/media-access", {
        mediaId,
        userId,
      });
      return await response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Media assigned",
        description: "The media has been assigned to the user successfully.",
      });
      // Invalidate both media access and the specific user's media cache
      queryClient.invalidateQueries({ queryKey: ["/api/media-access"] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${variables.userId}/media`] });
      setShowAssignDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error assigning media",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to remove media access
  const removeAccessMutation = useMutation({
    mutationFn: async ({ mediaId, userId }: { mediaId: number; userId: number }) => {
      await apiRequest("DELETE", `/api/media-access/${mediaId}/${userId}`);
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Access removed",
        description: "Media access has been removed successfully.",
      });
      // Invalidate both media access and the specific user's media cache
      queryClient.invalidateQueries({ queryKey: ["/api/media-access"] });
      queryClient.invalidateQueries({ queryKey: [`/api/users/${variables.userId}/media`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error removing access",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle user selection
  const handleUserChange = (userId: string) => {
    setSelectedUser(parseInt(userId));
  };

  // Handle media selection
  const handleMediaChange = (mediaId: string) => {
    setSelectedMedia(parseInt(mediaId));
  };

  // Handle assign button click
  const handleAssignMedia = () => {
    if (!selectedMedia || !selectedUser) {
      toast({
        title: "Selection required",
        description: "Please select both a user and media item",
        variant: "destructive",
      });
      return;
    }

    assignMediaMutation.mutate({
      mediaId: selectedMedia,
      userId: selectedUser,
    });
  };

  // Handle remove access
  const handleRemoveAccess = (mediaId: number) => {
    if (!selectedUser) return;

    if (window.confirm("Are you sure you want to remove this media access?")) {
      removeAccessMutation.mutate({
        mediaId,
        userId: selectedUser,
      });
    }
  };

  // Filter out media that's already assigned to the user
  const getUnassignedMedia = () => {
    if (!allMedia || !userMedia) return [];

    const assignedMediaIds = userMedia.map((item) => item.mediaId);
    return allMedia.filter((media) => !assignedMediaIds.includes(media.id));
  };

  // Display error if any
  if (clientsError || mediaError || userMediaError) {
    return (
      <div className="p-4 bg-red-50 text-red-500 rounded">
        Error loading data. Please try again later.
      </div>
    );
  }

  // Get media type icon component based on type
  const getMediaTypeIcon = (type: string) => {
    switch(type) {
      case 'video':
        return <PlayCircle className="h-4 w-4" />;
      case 'image':
        return <Image className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'presentation':
        return <Presentation className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const unassignedMedia = getUnassignedMedia();

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Client Media Access Management
          </CardTitle>
          <CardDescription>
            Assign and manage media access for client users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Client User</label>
              <Select
                value={selectedUser?.toString() || ""}
                onValueChange={handleUserChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a client user" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingClients ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.username} ({client.email})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <div className="pt-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium flex items-center">
                    <FileText className="mr-2 h-5 w-5" />
                    Assigned Media
                  </h3>
                  <Button
                    onClick={() => setShowAssignDialog(true)}
                    size="sm"
                    className="flex items-center"
                  >
                    <Plus className="mr-1 h-4 w-4" /> Assign Media
                  </Button>
                </div>

                {isLoadingUserMedia ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : !userMedia || userMedia.length === 0 ? (
                  <div className="py-8 text-center border rounded-md bg-muted/20">
                    <p className="text-muted-foreground">
                      No media currently assigned to this user.
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Date Assigned</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userMedia.map((access) => (
                          <TableRow key={access.id}>
                            <TableCell className="font-medium">
                              {access.media.title}
                            </TableCell>
                            <TableCell className="flex items-center">
                              {getMediaTypeIcon(access.media.type)}
                              <span className="ml-1 capitalize">
                                {access.media.type}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(access.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRemoveAccess(access.mediaId)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assign Media Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Media to User</DialogTitle>
            <DialogDescription>
              Select the media you want to grant access to this user.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <label className="text-sm font-medium">Select Media</label>
            <Select
              value={selectedMedia?.toString() || ""}
              onValueChange={handleMediaChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select media" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingMedia ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : unassignedMedia.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    No unassigned media available
                  </div>
                ) : (
                  unassignedMedia.map((media) => (
                    <SelectItem key={media.id} value={media.id.toString()}>
                      {media.title} ({media.type})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleAssignMedia}
              disabled={
                assignMediaMutation.isPending ||
                !selectedMedia ||
                !selectedUser
              }
            >
              {assignMediaMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}