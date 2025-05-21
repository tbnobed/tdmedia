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
import { ChevronLeft, ChevronRight } from "lucide-react";

// Interface for paginated API response
interface PaginatedResponse {
  items: Media[];
  pagination: {
    page: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
  };
}

export default function HomePage() {
  // Get user info for personalized welcome message
  const { user } = useAuth();
  
  // State for view type
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  
  // State for filters
  const [filters, setFilters] = useState({
    search: "",
    playlistId: undefined as number | undefined,
    sort: "newest",
  });
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8); // Default to 8 items per page
  
  // Media viewer state
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  
  // Contact form state
  const [contactMedia, setContactMedia] = useState<Media | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  
  // Fetch media with filters - uses client-specific endpoint for regular users
  const { data: paginatedData, isLoading, refetch } = useQuery<PaginatedResponse>({
    queryKey: [
      "/api/client/media", 
      filters.search, 
      filters.playlistId, 
      filters.sort,
      page,
      itemsPerPage
    ],
    // Add the pagination parameters to the request
    meta: {
      requestOptions: {
        params: {
          page,
          itemsPerPage
        }
      }
    }
  });
  
  // Handler for filter changes
  const handleFilterChange = (newFilters: {
    search: string;
    playlistId: number | undefined;
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
  
  // Get media data and pagination info
  const mediaItems = paginatedData?.items || [];
  const totalItems = paginatedData?.pagination?.totalItems || 0;
  const totalPages = paginatedData?.pagination?.totalPages || 0;
  const startItem = totalItems > 0 ? ((page - 1) * itemsPerPage) + 1 : 0;
  const endItem = Math.min(page * itemsPerPage, totalItems);
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        {/* Welcome message */}
        <div className="bg-gradient-to-r from-gray-900 to-black text-white">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {user ? (
                  <>Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-300 to-white">{user.username}</span>!</>
                ) : (
                  <>Welcome</>
                )}
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-300">
                {user?.isAdmin 
                  ? "Manage and share content with your clients securely." 
                  : "Browse your personalized media library with secure playback."}
              </p>
            </div>
          </div>
        </div>
        
        <MediaFilters
          onFilterChange={handleFilterChange}
          onViewChange={setViewType}
          view={viewType}
        />
        
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10">
          {isLoading ? (
            <div className="flex justify-center items-center py-8 sm:py-12">
              <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : viewType === "grid" ? (
            <MediaGrid media={mediaItems} onOpenMedia={handleOpenMedia} />
          ) : (
            <MediaList media={mediaItems} onOpenMedia={handleOpenMedia} />
          )}
          
          {/* Pagination */}
          {mediaItems && mediaItems.length > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                Showing <span className="font-medium">{startItem}</span> to{" "}
                <span className="font-medium">{endItem}</span> of{" "}
                <span className="font-medium">{totalItems}</span> results
              </div>
              
              <div className="flex flex-col sm:flex-row justify-center w-full sm:w-auto gap-3 sm:gap-4 items-center">
                {/* Items per page selector */}
                <div className="flex items-center gap-2">
                  <label htmlFor="itemsPerPage" className="text-xs sm:text-sm text-gray-700">
                    Items per page:
                  </label>
                  <select
                    id="itemsPerPage"
                    value={itemsPerPage}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      setItemsPerPage(newValue);
                      setPage(1); // Reset to first page when changing items per page
                    }}
                    className="h-8 rounded-md border border-gray-300 text-xs sm:text-sm px-2 py-1 bg-white"
                  >
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                    <option value={16}>16</option>
                    <option value={24}>24</option>
                  </select>
                </div>
                
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                    className="h-9 rounded-l-md"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Mobile view: just show current/total */}
                  <div className="sm:hidden flex items-center justify-center px-3 py-2 border border-gray-300 bg-white">
                    <span className="text-xs font-medium text-gray-700">
                      Page {page} of {totalPages}
                    </span>
                  </div>
                  
                  {/* Desktop view: show page numbers */}
                  <div className="hidden sm:flex">
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => (
                      <Button
                        key={i}
                        variant={page === i + 1 ? "default" : "outline"}
                        className="h-9"
                        size="sm"
                        onClick={() => setPage(i + 1)}
                      >
                        {i + 1}
                      </Button>
                    ))}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages || totalPages === 0}
                    onClick={() => setPage(page + 1)}
                    className="h-9 rounded-r-md"
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
