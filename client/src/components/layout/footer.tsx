import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-black text-white border-t border-gray-800">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-3">
              <img src="/images/tbn-logo-white.png" alt="TBN Logo" className="h-8" />
            </div>
            <div className="flex justify-center md:justify-start space-x-6">
              <Link href="/terms" className="text-gray-300 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-300 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/contact" className="text-gray-300 hover:text-white transition-colors">
                Contact
              </Link>
            </div>
          </div>
          <div className="mt-4 md:mt-0">
            <p className="text-center text-base text-gray-400">&copy; {new Date().getFullYear()} TBN. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
