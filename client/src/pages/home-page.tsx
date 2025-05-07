import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Media } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import MediaFilters from "@/components/media/media-filters";
import MediaGrid from "@/components/media/media-grid";
import MediaList from "@/components/media/media-list";
import MediaViewer from "@/components/media/media-viewer";
import ContactForm from "@/components/contact/contact-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Film } from "lucide-react";

export default function HomePage() {
  // Get user info for personalized welcome message
  const { user } = useAuth();
  
  // State for view type
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  
  // State for filters
  const [filters, setFilters] = useState({
    search: "",
    categoryId: undefined as number | undefined,
    sort: "newest",
  });
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 8;
  
  // Media viewer state
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  
  // Contact form state
  const [contactMedia, setContactMedia] = useState<Media | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  
  // Fetch media with filters - uses client-specific endpoint for regular users
  const { data: mediaData, isLoading, refetch } = useQuery<Media[]>({
    queryKey: [
      "/api/client/media", 
      filters.search, 
      filters.categoryId, 
      filters.sort,
      page
    ],
  });
  
  // Set total items for pagination
  useEffect(() => {
    if (mediaData) {
      // In a real implementation, the API would return the total count
      // For now, we'll use the actual data length
      setTotalItems(mediaData.length);
    }
  }, [mediaData]);
  
  // Handler for filter changes
  const handleFilterChange = (newFilters: {
    search: string;
    categoryId: number | undefined;
    sort: string;
  }) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };
  
  // Handler for opening media viewer
  const handleOpenMedia = (media: Media) => {
    setSelectedMedia(media);
    setViewerOpen(true);
  };
  
  // Handler for opening contact form
  const handleContactRequest = (media: Media) => {
    setContactMedia(media);
    setContactOpen(true);
  };
  
  // Calculate pagination values
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalItems);
  
  // Filtered media for current page
  const paginatedMedia = mediaData ? mediaData.slice(0, itemsPerPage) : [];
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Welcome message */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center">
              <Film className="h-10 w-10 mr-4" />
              <div>
                <h1 className="text-3xl font-bold">
                  {user ? (
                    <>Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 to-yellow-400">{user.username}</span>!</>
                  ) : (
                    <>Welcome to Trilogy Digital Media</>
                  )}
                </h1>
                <p className="mt-2 text-blue-100">
                  {user?.isAdmin 
                    ? "Manage and share content with your clients securely." 
                    : "Browse your personalized media library with secure playback."}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <MediaFilters
          onFilterChange={handleFilterChange}
          onViewChange={setViewType}
          view={viewType}
        />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : viewType === "grid" ? (
            <MediaGrid media={paginatedMedia} onOpenMedia={handleOpenMedia} />
          ) : (
            <MediaList media={paginatedMedia} onOpenMedia={handleOpenMedia} />
          )}
          
          {/* Pagination */}
          {mediaData && mediaData.length > 0 && (
            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startItem}</span> to{" "}
                <span className="font-medium">{endItem}</span> of{" "}
                <span className="font-medium">{totalItems}</span> results
              </div>
              
              <div className="flex-1 flex justify-center sm:justify-end">
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                    <Button
                      key={i}
                      variant={page === i + 1 ? "default" : "outline"}
                      className="relative inline-flex items-center px-4 py-2"
                      onClick={() => setPage(i + 1)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                  
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </nav>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
      
      {/* Media viewer */}
      <MediaViewer
        media={selectedMedia}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        onContactRequest={handleContactRequest}
      />
      
      {/* Contact form */}
      <ContactForm
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        media={contactMedia}
      />
    </div>
  );
}
