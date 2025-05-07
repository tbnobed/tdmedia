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
import { Category } from "@shared/schema";
import { Search, Grid, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MediaFiltersProps {
  onFilterChange: (filters: { 
    search: string;
    categoryId: number | undefined;
    sort: string;
  }) => void;
  onViewChange: (view: "grid" | "list") => void;
  view: "grid" | "list";
}

export default function MediaFilters({ onFilterChange, onViewChange, view }: MediaFiltersProps) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [sort, setSort] = useState("newest");
  
  // Fetch categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });
  
  // Apply filters when any filter value changes
  useEffect(() => {
    onFilterChange({
      search,
      categoryId: categoryId === "all" ? undefined : parseInt(categoryId),
      sort,
    });
  }, [search, categoryId, sort, onFilterChange]);
  
  return (
    <div className="bg-white shadow">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
        
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="w-full sm:w-auto sm:flex-grow max-w-md">
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="text"
                name="search"
                placeholder="Search media..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="w-full sm:w-auto">
            <Select
              value={categoryId}
              onValueChange={(value) => setCategoryId(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Sort */}
          <div className="w-full sm:w-auto">
            <Select
              value={sort}
              onValueChange={(value) => setSort(value)}
            >
              <SelectTrigger className="w-[150px]">
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
          
          {/* Grid/List View Toggle */}
          <div className="w-full sm:w-auto sm:ml-auto flex space-x-2">
            <Button
              variant={view === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => onViewChange("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => onViewChange("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
