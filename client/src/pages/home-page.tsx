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
  
  // State for filters and pagination in a single state object to ensure consistency
  const [queryParams, setQueryParams] = useState({
    search: "",
    playlistId: undefined as number | undefined,
    sort: "newest",
    page: 1,
    itemsPerPage: 8
  });
  
  // Media viewer state
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  
  // Contact form state
  const [contactMedia, setContactMedia] = useState<Media | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  
  // Create a more reliable query for media
  const { data: mediaData, isLoading } = useQuery<PaginatedResponse>({
    queryKey: [
      "/api/client/media", 
      queryParams.search, 
      queryParams.playlistId, 
      queryParams.sort, 
      queryParams.page, 
      queryParams.itemsPerPage
    ],
    queryFn: async () => {
      // Build URL with query parameters
      const params = new URLSearchParams();
      if (queryParams.search) params.append("search", queryParams.search);
      if (queryParams.playlistId) params.append("playlistId", queryParams.playlistId.toString());
      if (queryParams.sort) params.append("sort", queryParams.sort);
      params.append("page", queryParams.page.toString());
      params.append("itemsPerPage", queryParams.itemsPerPage.toString());
      
      const url = `/api/client/media?${params.toString()}`;
      console.log(`Fetching page ${queryParams.page}, ${queryParams.itemsPerPage} items per page | ${url}`);
      
      // Make request with cache-busting headers
      const response = await fetch(url, { 
        credentials: "include",
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      return response.json();
    },
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchInterval: false
  });
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    console.log(`Changing to page ${newPage}`);
    // Update all query parameters at once to maintain consistency
    setQueryParams(prev => ({
      ...prev,
      page: newPage
    }));
  };
  
  // Handler for filter changes
  const handleFilterChange = (newFilters: {
    search: string;
    playlistId: number | undefined;
    sort: string;
  }) => {
    // When filters change, update all parameters and reset to page 1
    setQueryParams(prev => ({
      ...prev,
      ...newFilters,
      page: 1 // Reset to first page when filters change
    }));
  };
  
  // Handler for items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    // When items per page changes, update and reset to page 1
    setQueryParams(prev => ({
      ...prev,
      itemsPerPage: newItemsPerPage,
      page: 1
    }));
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
  
  // Extract data from the paginated response with defaults
  const mediaItems = mediaData?.items || [];
  const pagination = mediaData?.pagination || { 
    page: queryParams.page, 
    itemsPerPage: queryParams.itemsPerPage, 
    totalItems: 0, 
    totalPages: 0 
  };
  
  // Calculate pagination information
  const { page, totalItems, totalPages } = pagination;
  const startItem = totalItems > 0 ? ((page - 1) * queryParams.itemsPerPage) + 1 : 0;
  const endItem = Math.min(page * queryParams.itemsPerPage, totalItems);
  
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
                    value={queryParams.itemsPerPage}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value);
                      handleItemsPerPageChange(newValue);
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
                    disabled={page <= 1}
                    onClick={() => handlePageChange(page - 1)}
                    className="h-9 rounded-l-md"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Mobile view: just show current/total */}
                  <div className="sm:hidden flex items-center justify-center px-3 py-2 border border-gray-300 bg-white">
                    <span className="text-xs font-medium text-gray-700">
                      Page {page} of {totalPages || 1}
                    </span>
                  </div>
                  
                  {/* Desktop view: show page numbers */}
                  <div className="hidden sm:flex">
                    {Array.from({ length: Math.min(5, totalPages || 1) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        // If 5 or fewer pages, show all
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        // Near start, show first 5
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        // Near end, show last 5
                        pageNum = totalPages - 4 + i;
                      } else {
                        // In middle, show current and 2 on each side
                        pageNum = page - 2 + i;
                      }
                      
                      if (pageNum <= totalPages && pageNum > 0) {
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "outline"}
                            className="h-9"
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      }
                      return null;
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || totalPages === 0}
                    onClick={() => handlePageChange(page + 1)}
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
