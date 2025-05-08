import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, Menu, X } from "lucide-react";

export default function Header() {
  const { user, logoutMutation } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        // Redirect to the auth page after logout
        setLocation('/auth');
      }
    });
  };

  return (
    <header className="bg-black text-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <Link href="/">
                <div className="flex items-center gap-2 cursor-pointer">
                  <img src="/images/tbn-logo-white.png" alt="TBN Logo" className="h-8" />
                </div>
              </Link>
            </div>

            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link href="/" className={`${location === '/' ? 'border-white text-white' : 'border-transparent text-gray-300 hover:border-gray-400 hover:text-white'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                Library
              </Link>
              {user?.isAdmin && (
                <Link href="/admin" className={`${location === '/admin' ? 'border-white text-white' : 'border-transparent text-gray-300 hover:border-gray-400 hover:text-white'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                  Admin
                </Link>
              )}
              <Link href="/contact" className={`${location === '/contact' ? 'border-white text-white' : 'border-transparent text-gray-300 hover:border-gray-400 hover:text-white'} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}>
                Contact Us
              </Link>
            </nav>
          </div>

          <div className="flex items-center">
            <div className="hidden sm:flex sm:items-center sm:ml-6">
              <div className="ml-3 relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative rounded-full h-8 w-8 p-0 text-white hover:bg-gray-800">
                      <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-white">
                        <User className="h-4 w-4" />
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="px-4 py-2">
                      <p className="text-sm font-medium">{user?.username}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="flex items-center sm:hidden">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center text-white hover:bg-gray-800"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden bg-gray-900">
          <div className="pt-2 pb-3 space-y-1">
            <Link 
              href="/"
              className={`${location === '/' ? 'bg-gray-800 border-white text-white' : 'border-transparent text-gray-300 hover:bg-gray-800 hover:border-gray-300 hover:text-white'} block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Library
            </Link>
            {user?.isAdmin && (
              <Link 
                href="/admin"
                className={`${location === '/admin' ? 'bg-gray-800 border-white text-white' : 'border-transparent text-gray-300 hover:bg-gray-800 hover:border-gray-300 hover:text-white'} block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Admin
              </Link>
            )}
            <Link 
              href="/contact"
              className={`${location === '/contact' ? 'bg-gray-800 border-white text-white' : 'border-transparent text-gray-300 hover:bg-gray-800 hover:border-gray-300 hover:text-white'} block pl-3 pr-4 py-2 border-l-4 text-base font-medium`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact Us
            </Link>
          </div>

          <div className="pt-4 pb-3 border-t border-gray-800">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-white">
                  <User className="h-5 w-5" />
                </div>
              </div>
              <div className="ml-3">
                <div className="text-base font-medium text-white">{user?.username}</div>
                <div className="text-sm font-medium text-gray-400 truncate">{user?.email}</div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <button 
                className="block w-full text-left px-4 py-2 text-base font-medium text-gray-300 hover:text-white hover:bg-gray-800"
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
