import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Users, 
  UserPlus, 
  Shield, 
  User, 
  UserCog, 
  AlertCircle,
  Trash2,
  Loader2
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";

// Define schemas for form validation
const createAdminSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type CreateAdminFormValues = z.infer<typeof createAdminSchema>;
type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export default function AdminUserManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isUpdatePasswordOpen, setIsUpdatePasswordOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<any>(null);
  
  // Fetch all users
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json();
    },
  });
  
  // Create admin user mutation
  const createAdminMutation = useMutation({
    mutationFn: async (userData: CreateAdminFormValues) => {
      const res = await apiRequest("POST", "/api/users/admins", userData);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create admin user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Admin user has been created successfully",
      });
      setIsCreateAdminOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      createAdminForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create admin user",
        variant: "destructive",
      });
    },
  });
  
  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async (passwordData: UpdatePasswordFormValues) => {
      if (!user) throw new Error("User not authenticated");
      
      const res = await apiRequest("PUT", `/api/users/${user.id}/credentials`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update password");
      }
      
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password has been updated successfully",
      });
      setIsUpdatePasswordOpen(false);
      updatePasswordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    },
  });
  
  // Delete admin user mutation
  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: number) => {
      const response = await apiRequest("DELETE", `/api/users/admins/${adminId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete admin user');
      }
      return adminId;
    },
    onSuccess: () => {
      toast({
        title: "Admin user deleted",
        description: "The admin user has been removed successfully",
      });
      // Close the delete dialog
      setDeleteDialogOpen(false);
      setAdminToDelete(null);
      // Refresh the users list
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting admin user",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Form for creating admin users
  const createAdminForm = useForm<CreateAdminFormValues>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });
  
  // Form for updating password
  const updatePasswordForm = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  
  // Handler for creating admin user
  const onCreateAdminSubmit = (data: CreateAdminFormValues) => {
    createAdminMutation.mutate(data);
  };
  
  // Handler for updating password
  const onUpdatePasswordSubmit = (data: UpdatePasswordFormValues) => {
    updatePasswordMutation.mutate(data);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage admin users and update your credentials
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsUpdatePasswordOpen(true)}>
            <UserCog className="mr-2 h-4 w-4" />
            Update Credentials
          </Button>
          <Button onClick={() => setIsCreateAdminOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create Admin
          </Button>
        </div>
      </div>
      
      <Separator />
      
      <Tabs defaultValue="admins" className="w-full">
        <TabsList>
          <TabsTrigger value="admins" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            Administrators
          </TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Clients
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="admins" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Admin Users
              </CardTitle>
              <CardDescription>
                Administrator accounts with full system access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="flex justify-center py-6 text-destructive">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Failed to load users
                </div>
              ) : (
                <Table>
                  <TableCaption>List of administrator accounts</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter((user: any) => user.isAdmin).map((admin: any) => (
                      <TableRow key={admin.id}>
                        <TableCell className="font-medium">{admin.username}</TableCell>
                        <TableCell>{admin.email}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {user && admin.id !== user.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAdminToDelete(admin);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={deleteAdminMutation.isPending && deleteAdminMutation.variables === admin.id}
                            >
                              {deleteAdminMutation.isPending && deleteAdminMutation.variables === admin.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 text-destructive" />
                              )}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="clients" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Client Users
              </CardTitle>
              <CardDescription>
                Client accounts with limited media access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="flex justify-center py-6 text-destructive">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Failed to load users
                </div>
              ) : (
                <Table>
                  <TableCaption>List of client accounts</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.filter((user: any) => !user.isAdmin).map((client: any) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.username}</TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">
                            <User className="h-3 w-3 mr-1" />
                            Client
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Create Admin Dialog */}
      <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
            <DialogDescription>
              Add a new administrator to the system with full access privileges.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createAdminForm}>
            <form onSubmit={createAdminForm.handleSubmit(onCreateAdminSubmit)} className="space-y-4 py-4">
              <FormField
                control={createAdminForm.control}
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
                control={createAdminForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createAdminForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateAdminOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createAdminMutation.isPending}
                >
                  {createAdminMutation.isPending ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Creating...
                    </>
                  ) : (
                    <>Create Admin</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Update Password Dialog */}
      <Dialog open={isUpdatePasswordOpen} onOpenChange={setIsUpdatePasswordOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Password</DialogTitle>
            <DialogDescription>
              Change your account password. You'll need to know your current password.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...updatePasswordForm}>
            <form onSubmit={updatePasswordForm.handleSubmit(onUpdatePasswordSubmit)} className="space-y-4 py-4">
              <FormField
                control={updatePasswordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter current password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={updatePasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={updatePasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Confirm new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsUpdatePasswordOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updatePasswordMutation.isPending}
                >
                  {updatePasswordMutation.isPending ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Updating...
                    </>
                  ) : (
                    <>Update Password</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Admin Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin User</AlertDialogTitle>
            <AlertDialogDescription>
              {adminToDelete && (
                <>
                  Are you sure you want to delete the admin user <strong>{adminToDelete.username}</strong>?
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={deleteAdminMutation.isPending}
              onClick={() => setAdminToDelete(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteAdminMutation.isPending}
              onClick={() => {
                if (adminToDelete) {
                  deleteAdminMutation.mutate(adminToDelete.id);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteAdminMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>Delete</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}