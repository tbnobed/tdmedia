import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Users, RefreshCw, CheckCircle2, AlertCircle, Trash2, Search, CheckSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";

// Create a form schema based on the insertUserSchema but ensure password is required
const createClientSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters long"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters long"),
  isAdmin: z.boolean().default(false),
  sendWelcomeEmail: z.boolean().default(true),
  assignMedia: z.array(z.number()).optional(),
});

type CreateClientFormValues = z.infer<typeof createClientSchema>;

interface User {
  id: number;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
}

interface Media {
  id: number;
  title: string;
  type: string;
  fileUrl: string;
  thumbnailUrl?: string;
}

export default function ClientManagement() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<User | null>(null);
  const [sortOption, setSortOption] = useState<string>("nameAsc");
  const [mediaSearchQuery, setMediaSearchQuery] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState<{
    status: 'idle' | 'creating' | 'assigning' | 'emailing' | 'complete' | 'error';
    message: string;
    error?: string;
  }>({
    status: 'idle',
    message: '',
  });

  // Query for existing client users
  const {
    data: clients,
    isLoading: isLoadingClients,
    error: clientsError,
    refetch: refetchClients,
  } = useQuery<User[]>({
    queryKey: ["/api/users/clients"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Delete client mutation
  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: number) => {
      const res = await apiRequest("DELETE", `/api/users/clients/${clientId}`);
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return clientId;
    },
    onSuccess: () => {
      toast({
        title: "Client deleted",
        description: "Client and all their media access have been removed",
      });
      // Close the delete dialog
      setDeleteDialogOpen(false);
      setClientToDelete(null);
      // Refresh the client list
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Query for media to assign during onboarding
  const {
    data: allMedia,
    isLoading: isLoadingMedia,
  } = useQuery<Media[]>({
    queryKey: ["/api/media"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Filter and sort media based on search query
  const filteredMedia = (allMedia?.filter(media =>
    media.title.toLowerCase().includes(mediaSearchQuery.toLowerCase()) ||
    media.type.toLowerCase().includes(mediaSearchQuery.toLowerCase())
  ) || []).sort((a, b) => a.title.localeCompare(b.title));

  // Form setup
  const form = useForm<CreateClientFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      isAdmin: false,
      sendWelcomeEmail: true,
      assignMedia: [],
    },
  });

  // Create client mutation
  const createClientMutation = useMutation({
    mutationFn: async (data: CreateClientFormValues) => {
      setOnboardingStatus({
        status: 'creating',
        message: 'Creating client account...',
      });

      // Use the correct admin endpoint for client creation
      const userRes = await apiRequest("POST", "/api/users/clients", {
        username: data.username,
        email: data.email,
        password: data.password,
        mediaIds: data.assignMedia, // Backend handles media assignment
        sendWelcomeEmail: data.sendWelcomeEmail, // Backend handles email sending
      });

      if (!userRes.ok) {
        const error = await userRes.text();
        throw new Error(error);
      }

      const response = await userRes.json();

      setOnboardingStatus({
        status: 'complete',
        message: 'Client created successfully!',
      });

      return response.user;
    },
    onSuccess: () => {
      toast({
        title: "Client created successfully",
        description: "The new client has been set up and can now access the system",
      });
      // Reset form and close dialog
      form.reset();
      setShowCreateDialog(false);
      setOnboardingStatus({ status: 'idle', message: '' });
      setMediaSearchQuery("");
      // Refresh the client list
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
    },
    onError: (error: Error) => {
      setOnboardingStatus({
        status: 'error',
        message: '',
        error: error.message,
      });
      toast({
        title: "Error creating client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateClientFormValues) => {
    createClientMutation.mutate(data);
  };

  const handleDeleteClient = (client: User) => {
    setClientToDelete(client);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteClientMutation.mutate(clientToDelete.id);
    }
  };

  if (clientsError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load clients: {clientsError.message}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Client Management
              </CardTitle>
              <CardDescription>
                Manage client accounts and their media access permissions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortOption} onValueChange={setSortOption}>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchClients()}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add New Client
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoadingClients ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : clients && clients.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients
                    .slice()
                    .sort((a, b) => {
                      switch (sortOption) {
                        case "nameAsc":
                          return a.username.localeCompare(b.username);
                        case "nameDesc":
                          return b.username.localeCompare(a.username);
                        case "newest":
                          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                        case "oldest":
                          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                        default:
                          return 0;
                      }
                    })
                    .map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.username}
                      </TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>
                        {new Date(client.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => {
                            // Store the client ID in localStorage for pre-selection
                            localStorage.setItem('selectedClientId', client.id.toString());
                            // Navigate to the admin page user media access tab
                            window.location.href = '/admin?tab=user-access';
                          }}
                        >
                          Manage Access
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClient(client)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-muted-foreground mb-4">No clients found.</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Create Your First Client
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Client Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Set up a new client account with media access permissions
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="account" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="account">Account Details</TabsTrigger>
                  <TabsTrigger value="access">Media Access</TabsTrigger>
                </TabsList>
                
                <TabsContent value="account" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter email address" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter password" type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isAdmin"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Admin Access</FormLabel>
                          <FormDescription>
                            Allow this user to manage other users and media
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sendWelcomeEmail"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Send Welcome Email</FormLabel>
                          <FormDescription>
                            Send login credentials and welcome message to the new client
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="access" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="assignMedia"
                    render={({ field }) => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Assign Media</FormLabel>
                          <FormDescription>
                            Select media items to grant access to this client
                          </FormDescription>
                        </div>
                        
                        {/* Search and bulk actions */}
                        <div className="space-y-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Search media by title or type..."
                              value={mediaSearchQuery}
                              onChange={(e) => setMediaSearchQuery(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                          
                          {filteredMedia.length > 0 && (
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  form.setValue("assignMedia", filteredMedia.map(media => media.id));
                                }}
                              >
                                <CheckSquare className="h-4 w-4 mr-1" />
                                Assign All ({filteredMedia.length})
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  form.setValue("assignMedia", []);
                                }}
                              >
                                Clear All
                              </Button>
                            </div>
                          )}
                        </div>

                        {isLoadingMedia ? (
                          <div className="py-4 flex justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : filteredMedia && filteredMedia.length > 0 ? (
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[50px]">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id="select-all-filtered-media"
                                        checked={filteredMedia && form.getValues("assignMedia")?.length === filteredMedia.length && filteredMedia.every(media => form.getValues("assignMedia")?.includes(media.id))}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            form.setValue("assignMedia", filteredMedia?.map(media => media.id) || []);
                                          } else {
                                            form.setValue("assignMedia", []);
                                          }
                                        }}
                                      />
                                      <label htmlFor="select-all-filtered-media" className="text-xs font-normal">All</label>
                                    </div>
                                  </TableHead>
                                  <TableHead>Title</TableHead>
                                  <TableHead>Type</TableHead>
                                </TableRow>
                              </TableHeader>
                            </Table>
                            <ScrollArea className="h-[300px]">
                              <Table>
                                <TableBody>
                                  {filteredMedia.map((media) => (
                                    <TableRow key={media.id}>
                                      <TableCell className="w-[50px]">
                                        <FormField
                                          control={form.control}
                                          name="assignMedia"
                                          render={({ field }) => (
                                            <FormItem className="flex items-center space-x-2">
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(media.id)}
                                                  onCheckedChange={(checked) => {
                                                    if (checked) {
                                                      field.onChange([...field.value || [], media.id]);
                                                    } else {
                                                      field.onChange(
                                                        field.value?.filter(
                                                          (value) => value !== media.id
                                                        ) || []
                                                      );
                                                    }
                                                  }}
                                                />
                                              </FormControl>
                                            </FormItem>
                                          )}
                                        />
                                      </TableCell>
                                      <TableCell>{media.title}</TableCell>
                                      <TableCell className="capitalize">{media.type}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </ScrollArea>
                          </div>
                        ) : mediaSearchQuery ? (
                          <div className="py-4 text-center border rounded-md bg-muted/20">
                            <p className="text-muted-foreground">No media found matching "{mediaSearchQuery}"</p>
                          </div>
                        ) : allMedia && allMedia.length > 0 ? (
                          <div className="py-4 text-center border rounded-md bg-muted/20">
                            <p className="text-muted-foreground">Use the search box to find media items</p>
                          </div>
                        ) : (
                          <div className="py-4 text-center border rounded-md bg-muted/20">
                            <p className="text-muted-foreground">No media items available.</p>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    form.reset();
                    setOnboardingStatus({ status: 'idle', message: '' });
                    setMediaSearchQuery("");
                  }}
                  disabled={createClientMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createClientMutation.isPending}
                >
                  {createClientMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {onboardingStatus.status === 'creating' && 'Creating...'}
                      {onboardingStatus.status === 'assigning' && 'Assigning Media...'}
                      {onboardingStatus.status === 'emailing' && 'Sending Email...'}
                    </>
                  ) : (
                    'Create Client'
                  )}
                </Button>
              </DialogFooter>

              {/* Onboarding Status */}
              {onboardingStatus.status !== 'idle' && (
                <div className="mt-4 p-4 border rounded-lg">
                  {onboardingStatus.status === 'error' ? (
                    <div className="flex items-center space-x-2 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>Error: {onboardingStatus.error}</span>
                    </div>
                  ) : onboardingStatus.status === 'complete' ? (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{onboardingStatus.message}</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{onboardingStatus.message}</span>
                    </div>
                  )}
                </div>
              )}
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{clientToDelete?.username}"? This will also remove all their media access permissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteClientMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClientMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Client'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}