import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Playlist } from "@shared/schema";
import { Search, Grid, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MediaFiltersProps {
  onFilterChange: (filters: { 
    search: string;
    playlistId: number | undefined;
    sort: string;
  }) => void;
  onViewChange: (view: "grid" | "list") => void;
  view: "grid" | "list";
}

export default function MediaFilters({ onFilterChange, onViewChange, view }: MediaFiltersProps) {
  const [search, setSearch] = useState("");
  const [playlistId, setPlaylistId] = useState<string>("all");
  const [sort, setSort] = useState("newest");
  
  // Fetch playlists
  const { data: playlists } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
  });
  
  // Apply filters when any filter value changes
  useEffect(() => {
    onFilterChange({
      search,
      playlistId: playlistId === "all" ? undefined : parseInt(playlistId),
      sort,
    });
  }, [search, playlistId, sort, onFilterChange]);
  
  return (
    <div className="bg-white shadow">
      <div className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-0">Media Library</h1>
          
          {/* Grid/List View Toggle - Moved to top right for better mobile access */}
          <div className="flex space-x-2">
            <Button
              variant={view === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => onViewChange("grid")}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => onViewChange("list")}
              className="h-8 w-8 sm:h-10 sm:w-10"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="text"
                name="search"
                placeholder="Search media..."
                className="pl-10 h-9 sm:h-10 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          {/* Playlist Filter */}
          <div>
            <Select
              value={playlistId}
              onValueChange={(value) => setPlaylistId(value)}
            >
              <SelectTrigger className="h-9 sm:h-10 w-full">
                <SelectValue placeholder="All Playlists" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Playlists</SelectItem>
                {playlists?.map((playlist) => (
                  <SelectItem key={playlist.id} value={playlist.id.toString()}>
                    {playlist.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Sort */}
          <div>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value)}
            >
              <SelectTrigger className="h-9 sm:h-10 w-full">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="a-z">A-Z</SelectItem>
                <SelectItem value="z-a">Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
