import { useState, useEffect } from "react";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MediaManagement from "@/components/admin/media-management";
import PlaylistManagement from "@/components/admin/playlist-management";
import ContactManagement from "@/components/admin/contact-management";
import UserMediaAccess from "@/components/admin/user-media-access";
import ClientManagement from "@/components/admin/client-management";
import AdminUserManagement from "@/components/admin/admin-user-management";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Shield, FileText, ListMusic, Mail, Users, UserPlus, UserCog } from "lucide-react";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("media");
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Check for hash in URL to set active tab - needed to run whenever hash changes
  useEffect(() => {
    // Remove the # character and get the tab name
    const hash = window.location.hash.substring(1);
    if (hash && ["media", "categories", "clients", "access", "contacts", "admins"].includes(hash)) {
      setActiveTab(hash);
    }
    
    // Set up listener for hash changes
    const handleHashChange = () => {
      const newHash = window.location.hash.substring(1);
      if (newHash && ["media", "categories", "clients", "access", "contacts", "admins"].includes(newHash)) {
        setActiveTab(newHash);
      }
    };
    
    // Add hash change listener
    window.addEventListener('hashchange', handleHashChange);
    
    // Clean up
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Double-check admin access
  if (user && !user.isAdmin) {
    setLocation("/");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex items-center">
            <Shield className="h-8 w-8 text-primary mr-4" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-500">Manage content, categories, and user inquiries</p>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs 
            defaultValue="media" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <TabsList className="grid grid-cols-6 w-full max-w-5xl mx-auto">
              <TabsTrigger value="media" className="flex items-center space-x-2">
                <FileText className="h-4 w-4" />
                <span>Media</span>
              </TabsTrigger>
              <TabsTrigger value="categories" className="flex items-center space-x-2">
                <ListMusic className="h-4 w-4" />
                <span>Playlists</span>
              </TabsTrigger>
              <TabsTrigger value="clients" className="flex items-center space-x-2">
                <UserPlus className="h-4 w-4" />
                <span>Clients</span>
              </TabsTrigger>
              <TabsTrigger value="access" className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Access</span>
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>Inquiries</span>
              </TabsTrigger>
              <TabsTrigger value="admins" className="flex items-center space-x-2">
                <UserCog className="h-4 w-4" />
                <span>Admins</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="media">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <MediaManagement />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="categories">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <PlaylistManagement />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="clients">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <ClientManagement />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="access">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <UserMediaAccess />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="contacts">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <ContactManagement />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="admins">
              <div className="bg-white rounded-lg shadow">
                <div className="p-6">
                  <AdminUserManagement />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
