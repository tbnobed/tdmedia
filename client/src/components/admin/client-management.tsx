import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, UserPlus, Users, RefreshCw, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
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
      const response = await apiRequest("DELETE", `/api/users/clients/${clientId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete client');
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
      // First create the user
      setOnboardingStatus({
        status: 'creating',
        message: 'Creating client account...',
      });

      // Extract the media IDs to assign
      const { assignMedia, ...userData } = data;
      
      // Format data for the API
      const requestData = {
        ...userData,
        mediaIds: assignMedia || [], // Pass the media IDs to assign in the request
      };
      
      // Use the dedicated endpoint for client creation which handles everything
      const createClientResponse = await apiRequest("POST", "/api/users/clients", requestData);
      if (!createClientResponse.ok) {
        const errorText = await createClientResponse.text();
        try {
          // Try to parse as JSON error
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.message || 'Failed to create client');
        } catch (e) {
          // If not JSON, use the text directly
          throw new Error(errorText || 'Failed to create client');
        }
      }
      
      const result = await createClientResponse.json();
      
      setOnboardingStatus({
        status: 'complete',
        message: 'Client onboarded successfully!' + 
          (result.emailSent ? ' Welcome email has been sent.' : ''),
      });
      
      return result.user;
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/users/clients"] });
      
      setTimeout(() => {
        // Close dialog and reset form after showing success message
        setShowCreateDialog(false);
        form.reset();
        setOnboardingStatus({
          status: 'idle',
          message: '',
        });
      }, 2000);
    },
    onError: (error: Error) => {
      setOnboardingStatus({
        status: 'error',
        message: 'Error during onboarding',
        error: error.message,
      });
      
      toast({
        title: "Error creating client",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: CreateClientFormValues) => {
    createClientMutation.mutate(data);
  };

  // Get onboarding status UI
  const getOnboardingStatusUi = () => {
    if (onboardingStatus.status === 'idle') return null;
    
    const getStatusIcon = () => {
      switch (onboardingStatus.status) {
        case 'creating':
        case 'assigning':
        case 'emailing':
          return <Loader2 className="h-4 w-4 animate-spin mr-2" />;
        case 'complete':
          return <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />;
        case 'error':
          return <AlertCircle className="h-4 w-4 text-red-500 mr-2" />;
        default:
          return null;
      }
    };
    
    return (
      <div 
        className={`flex items-center p-4 my-4 rounded-md ${
          onboardingStatus.status === 'error' ? 'bg-red-50 text-red-700' : 
          onboardingStatus.status === 'complete' ? 'bg-green-50 text-green-700' : 
          'bg-blue-50 text-blue-700'
        }`}
      >
        {getStatusIcon()}
        <div>
          <p className="font-medium">{onboardingStatus.message}</p>
          {onboardingStatus.error && (
            <p className="text-sm mt-1">{onboardingStatus.error}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Client User Management
          </CardTitle>
          <CardDescription>
            Create and manage client users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Client Users</h3>
              <p className="text-sm text-muted-foreground">
                All non-administrator users in the system
              </p>
            </div>
            <div className="space-x-2">
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
                  {clients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">
                        {client.username}
                      </TableCell>
                      <TableCell>{client.email}</TableCell>
                      <TableCell>
                        {new Date(client.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Store the selected client ID in localStorage
                              localStorage.setItem('selectedClientId', client.id.toString());
                              
                              // Navigate to the access tab directly
                              // First change the hash to trigger hash change event
                              window.location.hash = "";
                              // Then set it to "access" to navigate properly
                              setTimeout(() => {
                                window.location.hash = "access";
                              }, 50);
                            }}
                          >
                            Manage Access
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setClientToDelete(client);
                              setDeleteDialogOpen(true);
                            }}
                            disabled={deleteClientMutation.isPending}
                          >
                            {deleteClientMutation.isPending && deleteClientMutation.variables === client.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-8 text-center border rounded-md bg-muted/20">
              <p className="text-muted-foreground">No client users found.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateDialog(true)}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add Your First Client
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Client Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        if (!open) {
          // Reset onboarding status when dialog is closed
          setOnboardingStatus({
            status: 'idle',
            message: '',
          });
        }
        setShowCreateDialog(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Client</DialogTitle>
            <DialogDescription>
              Create a new client user account and set up their initial access.
            </DialogDescription>
          </DialogHeader>

          {getOnboardingStatusUi()}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="account" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="account">Account</TabsTrigger>
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
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormDescription>
                          This will be used to log in to the account.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" autoComplete="off" />
                        </FormControl>
                        <FormDescription>
                          This email will be used for communications.
                        </FormDescription>
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
                          <Input {...field} type="password" autoComplete="new-password" />
                        </FormControl>
                        <FormDescription>
                          Must be at least 6 characters long.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sendWelcomeEmail"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Send Welcome Email
                          </FormLabel>
                          <FormDescription>
                            Send an email with login credentials to the client
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
                        {isLoadingMedia ? (
                          <div className="py-4 flex justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : allMedia && allMedia.length > 0 ? (
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[50px]">
                                    <div className="flex items-center space-x-2">
                                      <Checkbox
                                        id="select-all-media"
                                        checked={allMedia && form.getValues("assignMedia")?.length === allMedia.length}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            form.setValue("assignMedia", allMedia?.map(media => media.id) || []);
                                          } else {
                                            form.setValue("assignMedia", []);
                                          }
                                        }}
                                      />
                                      <label htmlFor="select-all-media" className="text-xs font-normal">All</label>
                                    </div>
                                  </TableHead>
                                  <TableHead>Title</TableHead>
                                  <TableHead>Type</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {allMedia.map((media) => (
                                  <TableRow key={media.id}>
                                    <TableCell>
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
                  onClick={() => setShowCreateDialog(false)}
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
                      Creating...
                    </>
                  ) : (
                    "Create Client"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Client Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              {clientToDelete ? (
                <>
                  Are you sure you want to delete client <strong>{clientToDelete.username}</strong>?
                  <p className="mt-2">
                    This action will remove the client account and all their media access permissions.
                    This cannot be undone.
                  </p>
                </>
              ) : (
                'Are you sure you want to delete this client? This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteClientMutation.isPending}
              onClick={() => setClientToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteClientMutation.isPending}
              onClick={() => {
                if (clientToDelete) {
                  deleteClientMutation.mutate(clientToDelete.id);
                  // Dialog will close automatically when the delete mutation succeeds
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClientMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Client"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}