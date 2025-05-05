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
import { Loader2, Mail, CheckCircle, MessageSquare, User, Building, Calendar } from "lucide-react";

export default function ContactManagement() {
  const { toast } = useToast();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Fetch all contacts
  const { data: contacts, isLoading } = useQuery<Contact[]>({
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
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy h:mm a");
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Contact Inquiries</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage and respond to client inquiries about content.
        </p>
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
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts && contacts.length > 0 ? (
                contacts.map((contact) => (
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
