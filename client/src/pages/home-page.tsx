import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Media, Category } from "@shared/schema";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import MediaFilters from "@/components/media/media-filters";
import MediaGrid from "@/components/media/media-grid";
import MediaList from "@/components/media/media-list";
import MediaViewer from "@/components/media/media-viewer";
import ContactForm from "@/components/contact/contact-form";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { 
  ChevronLeft, 
  ChevronRight, 
  PlayCircle, 
  FileText, 
  Image as ImageIcon, 
  Presentation,
  ArrowRight,
  Search
} from "lucide-react";
import trilogyLogo from "@/assets/trilogy-logo.svg";

export default function HomePage() {
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

  // Fetch categories for hero section
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
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
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-primary/90 to-primary text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <img 
                  src={trilogyLogo} 
                  alt="Trilogy Digital Media Logo" 
                  className="h-20 w-20 mb-6 rounded-lg shadow-lg"
                />
                <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-200">
                  Welcome to Your Digital Media Library
                </h1>
                <p className="text-lg mb-8 max-w-md text-gray-100">
                  Securely browse our curated collection of premium content, tailored specifically for your preview and review.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Button 
                    size="lg" 
                    className="bg-white text-primary hover:bg-gray-100 transition-all shadow-md hover:shadow-lg"
                    onClick={() => {
                      const librarySection = document.getElementById('library-section');
                      if (librarySection) {
                        librarySection.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                  >
                    <Search className="mr-2 h-5 w-5" /> Browse Library
                  </Button>
                  <Link href="/contact">
                    <Button 
                      size="lg" 
                      variant="outline" 
                      className="border-white text-white hover:bg-white/10 transition-all"
                    >
                      <ArrowRight className="mr-2 h-5 w-5" /> Contact Us
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="hidden md:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-xl"></div>
                  <div className="grid grid-cols-2 gap-4 p-6 relative z-10">
                    <div className="bg-white/10 p-5 rounded-lg backdrop-blur-md shadow-lg hover:transform hover:scale-105 transition-all">
                      <PlayCircle className="h-10 w-10 text-white mb-3" />
                      <h3 className="text-xl font-bold mb-1">Videos</h3>
                      <p className="text-sm text-gray-200">High-quality video content with watermarking protection</p>
                    </div>
                    <div className="bg-white/10 p-5 rounded-lg backdrop-blur-md shadow-lg hover:transform hover:scale-105 transition-all">
                      <FileText className="h-10 w-10 text-white mb-3" />
                      <h3 className="text-xl font-bold mb-1">Documents</h3>
                      <p className="text-sm text-gray-200">Secured documents for review with controlled access</p>
                    </div>
                    <div className="bg-white/10 p-5 rounded-lg backdrop-blur-md shadow-lg hover:transform hover:scale-105 transition-all">
                      <ImageIcon className="h-10 w-10 text-white mb-3" />
                      <h3 className="text-xl font-bold mb-1">Images</h3>
                      <p className="text-sm text-gray-200">Protected image content with watermark technology</p>
                    </div>
                    <div className="bg-white/10 p-5 rounded-lg backdrop-blur-md shadow-lg hover:transform hover:scale-105 transition-all">
                      <Presentation className="h-10 w-10 text-white mb-3" />
                      <h3 className="text-xl font-bold mb-1">Presentations</h3>
                      <p className="text-sm text-gray-200">Presentation materials available for secure preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Category Quick Links (if categories exist) */}
        {categories && categories.length > 0 && (
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                <span className="text-gray-500 whitespace-nowrap">Quick access:</span>
                <Button
                  variant={!filters.categoryId ? "default" : "outline"}
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => setFilters({...filters, categoryId: undefined})}
                >
                  All Media
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category.id}
                    variant={filters.categoryId === category.id ? "default" : "outline"}
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => setFilters({...filters, categoryId: category.id})}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Library Section */}
        <div id="library-section">
          <MediaFilters
            onFilterChange={handleFilterChange}
            onViewChange={setViewType}
            view={viewType}
          />
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startItem}</span> to{" "}
                  <span className="font-medium">{endItem}</span> of{" "}
                  <span className="font-medium">{totalItems}</span> results
                </div>
                
                <div className="flex justify-center">
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border-gray-300"
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
        </div>

        {/* Call to action section */}
        <div className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                Need More Information?
              </h2>
              <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
                Contact our team to learn more about our complete media library and services
              </p>
              <Link href="/contact">
                <Button size="lg" className="px-8">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
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
