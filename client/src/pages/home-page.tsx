import { useState, useEffect } from "react";
import { Media } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import MediaFilters from "@/components/media/media-filters";
import MediaGrid from "@/components/media/media-grid";
import MediaList from "@/components/media/media-list";
import StableMediaViewer from "@/components/media/stable-media-viewer";
import ContactForm from "@/components/contact/contact-form";
import { VideoModal } from "@/components/media/video-modal";
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
  const [, setLocation] = useLocation();
  
  // State for view type
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  
  // Media viewer state
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  
  // Video modal state
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideoId, setSelectedVideoId] = useState<number | null>(null);
  
  // Contact form state
  const [contactMedia, setContactMedia] = useState<Media | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  
  // Filters and pagination state
  const [filters, setFilters] = useState({
    search: "",
    playlistId: undefined as number | undefined,
    sort: "a-z",
  });
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);
  
  // Data fetching state
  const [isLoading, setIsLoading] = useState(false);
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [paginationInfo, setPaginationInfo] = useState({
    page: 1,
    itemsPerPage: 8,
    totalItems: 0,
    totalPages: 0
  });
  
  // Function to fetch media data
  const fetchMediaData = async (pageToFetch = 1) => {
    // Set loading state
    setIsLoading(true);
    
    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters.search) params.append("search", filters.search);
      if (filters.playlistId) params.append("playlistId", filters.playlistId.toString());
      if (filters.sort) params.append("sort", filters.sort);
      params.append("page", pageToFetch.toString());
      params.append("itemsPerPage", itemsPerPage.toString());
      
      const url = `/api/client/media?${params}`;
      console.log(`Fetching page ${pageToFetch} with ${itemsPerPage} items per page`);
      
      // Make the request
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store"
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Parse response
      const data: PaginatedResponse = await response.json();
      console.log(`Received ${data.items.length} items for page ${pageToFetch}`);
      
      // Update state with data
      setMediaItems(data.items);
      setPaginationInfo(data.pagination);
      setPage(data.pagination.page);
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load initial data when component mounts or filters change
  useEffect(() => {
    fetchMediaData(1);
  }, [filters.search, filters.playlistId, filters.sort, itemsPerPage]);
  
  // Improved page change handler with state synchronization
  const handlePageChange = (newPage: number) => {
    if (isLoading) return; // Don't allow changes while loading
    
    console.log(`Changing to page ${newPage}`);
    setPage(newPage); // Update page state first
    fetchMediaData(newPage); // Then fetch data
  };
  
  // Handle filter changes
  const handleFilterChange = (newFilters: {
    search: string;
    playlistId: number | undefined;
    sort: string;
  }) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  };
  
  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setPage(1); // Reset to first page
  };
  
  // Handler for opening media viewer - use modal for videos, stable viewer for other media
  const handleOpenMedia = (media: Media) => {
    if (media.type === 'video') {
      setSelectedVideoId(media.id);
      setVideoModalOpen(true);
    } else {
      setSelectedMedia(media);
      setViewerOpen(true);
    }
  };
  
  // Handler for opening contact form
  const handleContactRequest = (media: Media) => {
    setContactMedia(media);
    setContactOpen(true);
  };
  
  // Extract pagination info for display
  const { totalItems, totalPages } = paginationInfo;
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
                
                <div className="flex items-center gap-1 bg-white p-1 rounded-md shadow-sm border border-gray-200">
                  {/* Previous button - simplified */}
                  <button 
                    type="button"
                    disabled={paginationInfo.page <= 1 || isLoading}
                    onClick={() => !isLoading && handlePageChange(paginationInfo.page - 1)}
                    className={`px-3 py-1 rounded text-sm flex items-center justify-center ${
                      paginationInfo.page <= 1 || isLoading 
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  
                  {/* Mobile: simple current/total */}
                  <div className="sm:hidden flex items-center px-3 py-1">
                    <span className="text-xs font-medium text-gray-700">
                      {paginationInfo.page} / {paginationInfo.totalPages || 1}
                    </span>
                  </div>
                  
                  {/* Super simplified pagination for stability */}
                  <div className="hidden sm:flex items-center space-x-2">
                    {/* First page button */}
                    <button
                      type="button"
                      disabled={paginationInfo.page === 1 || isLoading}
                      onClick={() => !isLoading && handlePageChange(1)}
                      className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
                        paginationInfo.page === 1 
                          ? 'bg-black text-white font-medium' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      1
                    </button>
                    
                    {/* Simple page numbers without complex calculations */}
                    {paginationInfo.totalPages > 1 && paginationInfo.page > 1 && paginationInfo.page < paginationInfo.totalPages && (
                      <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded text-sm bg-black text-white font-medium"
                      >
                        {paginationInfo.page}
                      </button>
                    )}
                    
                    {/* Last page button (if more than one page) */}
                    {paginationInfo.totalPages > 1 && (
                      <button
                        type="button"
                        disabled={paginationInfo.page === paginationInfo.totalPages || isLoading}
                        onClick={() => !isLoading && handlePageChange(paginationInfo.totalPages)}
                        className={`w-8 h-8 flex items-center justify-center rounded text-sm ${
                          paginationInfo.page === paginationInfo.totalPages 
                            ? 'bg-black text-white font-medium' 
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {paginationInfo.totalPages}
                      </button>
                    )}
                  </div>
                  
                  {/* Next button - simplified */}
                  <button 
                    type="button"
                    disabled={paginationInfo.page >= paginationInfo.totalPages || isLoading}
                    onClick={() => !isLoading && handlePageChange(paginationInfo.page + 1)}
                    className={`px-3 py-1 rounded text-sm flex items-center justify-center ${
                      paginationInfo.page >= paginationInfo.totalPages || isLoading 
                        ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
      
      {/* Video modal */}
      <VideoModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        mediaId={selectedVideoId}
      />
      
      {/* Media viewer */}
      <StableMediaViewer
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
