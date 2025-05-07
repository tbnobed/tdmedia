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
import { Search, Grid, List, SlidersHorizontal, Filter } from "lucide-react";
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
  
  // Handle search input with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    setSearch("");
    setCategoryId("all");
    setSort("newest");
  };
  
  return (
    <div className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Media Library</h1>
          
          {/* View Toggle */}
          <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-md">
            <Button
              variant={view === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange("grid")}
              className={`${view === "grid" ? "" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
            >
              <Grid className="h-4 w-4 mr-1" />
              Grid
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => onViewChange("list")}
              className={`${view === "list" ? "" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-300"}`}
            >
              <List className="h-4 w-4 mr-1" />
              List
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
              <Input
                type="text"
                name="search"
                placeholder="Search media by title or description..."
                className="pl-10 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
          </div>
          
          {/* Category Filter */}
          <div>
            <Select
              value={categoryId}
              onValueChange={(value) => setCategoryId(value)}
            >
              <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <Filter className="h-4 w-4 mr-2 text-gray-500" />
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
          <div>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value)}
            >
              <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <SlidersHorizontal className="h-4 w-4 mr-2 text-gray-500" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="a-z">A-Z</SelectItem>
                <SelectItem value="z-a">Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Active Filters */}
        {(search || categoryId !== "all" || sort !== "newest") && (
          <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
            <span>Active filters:</span>
            <div className="ml-2 flex flex-wrap gap-2">
              {search && (
                <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="mr-1">Search: {search}</span>
                </div>
              )}
              {categoryId !== "all" && categories && (
                <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="mr-1">Category: {categories.find(c => c.id.toString() === categoryId)?.name}</span>
                </div>
              )}
              {sort !== "newest" && (
                <div className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="mr-1">Sort: {
                    sort === "oldest" ? "Oldest First" :
                    sort === "a-z" ? "A-Z" :
                    sort === "z-a" ? "Z-A" : sort
                  }</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 h-6 px-2"
              >
                Clear all
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
