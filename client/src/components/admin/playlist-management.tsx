import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Playlist, insertPlaylistSchema } from "@shared/schema";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, ListMusic } from "lucide-react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PlaylistFormValues = z.infer<typeof insertPlaylistSchema>;

export default function PlaylistManagement() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [sortOption, setSortOption] = useState<string>("nameAsc");

  // Fetch all playlists
  const { data: playlists, isLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
  });

  // Add playlist form
  const addForm = useForm<PlaylistFormValues>({
    resolver: zodResolver(insertPlaylistSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Edit playlist form
  const editForm = useForm<PlaylistFormValues>({
    resolver: zodResolver(insertPlaylistSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: PlaylistFormValues) => {
      const res = await apiRequest("POST", "/api/playlists", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create playlist");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: "Success",
        description: "Playlist created successfully",
      });
      setAddDialogOpen(false);
      addForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PlaylistFormValues & { id: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PUT", `/api/playlists/${id}`, updateData);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update playlist");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: "Success",
        description: "Playlist updated successfully",
      });
      setEditDialogOpen(false);
      editForm.reset();
      setSelectedPlaylist(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/playlists/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete playlist");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      toast({
        title: "Success",
        description: "Playlist deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedPlaylist(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form submission handlers
  const onAddSubmit = (data: PlaylistFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: PlaylistFormValues) => {
    if (!selectedPlaylist) return;
    updateMutation.mutate({ ...data, id: selectedPlaylist.id });
  };

  const onDeleteConfirm = () => {
    if (!selectedPlaylist) return;
    deleteMutation.mutate(selectedPlaylist.id);
  };

  // Open edit dialog with selected playlist data
  const handleEditClick = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    editForm.reset({
      name: playlist.name,
      description: playlist.description || "",
    });
    setEditDialogOpen(true);
  };

  // Open delete confirmation dialog
  const handleDeleteClick = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight">Playlists</h2>
        <div className="flex items-center gap-2">
          <Select
            value={sortOption}
            onValueChange={setSortOption}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nameAsc">Name (A-Z)</SelectItem>
              <SelectItem value="nameDesc">Name (Z-A)</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Playlist
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : playlists && playlists.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {playlists
              .slice()
              .sort((a, b) => {
                switch (sortOption) {
                  case "nameAsc":
                    return a.name.localeCompare(b.name);
                  case "nameDesc":
                    return b.name.localeCompare(a.name);
                  case "newest":
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
                  case "oldest":
                    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                  default:
                    return 0;
                }
              })
              .map((playlist) => (
              <TableRow key={playlist.id}>
                <TableCell className="font-medium">{playlist.name}</TableCell>
                <TableCell>{playlist.description || "No description"}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleEditClick(playlist)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDeleteClick(playlist)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="border rounded-lg p-8 text-center">
          <ListMusic className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold mb-2">No playlists found</h3>
          <p className="text-muted-foreground mb-4">
            Create a playlist to organize your media.
          </p>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Playlist
          </Button>
        </div>
      )}

      {/* Add Playlist Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Playlist</DialogTitle>
            <DialogDescription>
              Create a new playlist to organize your media.
            </DialogDescription>
          </DialogHeader>

          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
              <FormField
                control={addForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Playlist name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of this playlist"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Playlist
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Playlist Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Playlist</DialogTitle>
            <DialogDescription>
              Update the playlist details.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Playlist name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of this playlist"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Playlist
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the playlist "{selectedPlaylist?.name}". Media items will be
              moved to the default playlist. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}