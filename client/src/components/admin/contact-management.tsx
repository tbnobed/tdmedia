import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Contact } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, CheckCircle, MessageSquare, User, Building, Calendar, Filter, RefreshCw, SortAsc, SortDesc } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ContactManagement() {
  const { toast } = useToast();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOption, setSortOption] = useState<string>("newest");

  // Fetch all contacts
  const { data: contacts, isLoading, refetch } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  // Mark contact as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PUT", `/api/contacts/${id}/read`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Marked as read",
        description: "The contact has been marked as read.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to mark contact as read: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // View contact details
  const handleViewContact = (contact: Contact) => {
    setSelectedContact(contact);
    setViewDialogOpen(true);
    
    // If contact is not read, mark it as read
    if (!contact.isRead) {
      markAsReadMutation.mutate(contact.id);
    }
  };

  // Format date
  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      return format(date, "MMM d, yyyy h:mm a");
    } catch (error) {
      return String(dateString);
    }
  };

  // Filter contacts by status
  const filteredContacts = contacts?.filter(contact => {
    if (statusFilter === "all") return true;
    if (statusFilter === "read") return contact.isRead;
    if (statusFilter === "unread") return !contact.isRead;
    return true;
  }) || [];

  // Sort contacts based on selected option
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    switch (sortOption) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "nameAsc":
        return a.name.localeCompare(b.name);
      case "nameDesc":
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  return (
    <div>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>Contact Inquiries</CardTitle>
                {contacts && contacts.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {sortedContacts.length} of {contacts.length}
                  </Badge>
                )}
              </div>
              <CardDescription>
                Manage and respond to client inquiries about content.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className="w-[160px]">
                  <Filter className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Filter by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Inquiries</SelectItem>
                  <SelectItem value="unread">Unread Only</SelectItem>
                  <SelectItem value="read">Read Only</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortOption}
                onValueChange={setSortOption}
              >
                <SelectTrigger className="w-[160px]">
                  <SortAsc className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Sort by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="nameAsc">Name (A-Z)</SelectItem>
                  <SelectItem value="nameDesc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 && !isLoading && (
            <div className="py-4 text-center text-muted-foreground">
              No inquiries match your filter criteria.
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContacts.length > 0 ? (
                sortedContacts.map((contact) => (
                  <TableRow key={contact.id} className={contact.isRead ? "" : "bg-blue-50"}>
                    <TableCell>
                      <Badge variant={contact.isRead ? "outline" : "default"}>
                        {contact.isRead ? "Read" : "New"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.email}</TableCell>
                    <TableCell>{formatDate(contact.createdAt)}</TableCell>
                    <TableCell>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewContact(contact)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No inquiries found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* View Contact Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Inquiry</DialogTitle>
            <DialogDescription>
              Review the details of this inquiry.
            </DialogDescription>
          </DialogHeader>
          
          {selectedContact && (
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-md">
                <Mail className="h-8 w-8 text-primary flex-shrink-0 mt-1" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{selectedContact.name}</h3>
                    {selectedContact.isRead && (
                      <Badge variant="outline" className="ml-2">
                        <CheckCircle className="h-3 w-3 mr-1" /> Read
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-1 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      <span>{selectedContact.email}</span>
                    </div>
                    {selectedContact.company && (
                      <div className="flex items-center gap-1">
                        <Building className="h-3.5 w-3.5" />
                        <span>{selectedContact.company}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(selectedContact.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold mb-2">Message:</h4>
                <div className="p-4 border rounded-md whitespace-pre-wrap">
                  {selectedContact.message}
                </div>
              </div>
              
              {selectedContact.mediaId && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Related to Media ID:</h4>
                  <div className="p-2 bg-gray-50 rounded-md text-sm">
                    {selectedContact.mediaId}
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setViewDialogOpen(false)}
                >
                  Close
                </Button>
                <Button 
                  variant="default"
                  onClick={() => {
                    // This would typically open your email client or CRM
                    window.open(`mailto:${selectedContact.email}?subject=RE: Your inquiry about our media content`);
                  }}
                >
                  Reply via Email
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
