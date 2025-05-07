import { Link } from "wouter";
import trilogyLogo from "@/assets/trilogy-logo.svg";

export default function Footer() {
  return (
    <footer className="bg-green-800 text-white border-t border-green-700">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-3">
              <img src={trilogyLogo} alt="Trilogy Digital Media Logo" className="h-6 w-6" />
              <span className="font-semibold text-white">Trilogy Digital Media</span>
            </div>
            <div className="flex justify-center md:justify-start space-x-6">
              <Link href="/terms" className="text-green-100 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-green-100 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/contact" className="text-green-100 hover:text-white transition-colors">
                Contact
              </Link>
            </div>
          </div>
          <div className="mt-4 md:mt-0">
            <p className="text-center text-base text-green-200">&copy; {new Date().getFullYear()} Trilogy Digital Media. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
