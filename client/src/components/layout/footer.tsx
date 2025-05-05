import { Link } from "wouter";
import trilogyLogo from "@/assets/trilogy-logo.svg";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="flex flex-col items-center md:items-start mb-4 md:mb-0">
            <div className="flex items-center gap-2 mb-3">
              <img src={trilogyLogo} alt="Trilogy Digital Media Logo" className="h-6 w-6" />
              <span className="font-semibold text-gray-700">Trilogy Digital Media</span>
            </div>
            <div className="flex justify-center md:justify-start space-x-6">
              <Link href="/terms">
                <a className="text-gray-400 hover:text-gray-500">
                  Terms of Service
                </a>
              </Link>
              <Link href="/privacy">
                <a className="text-gray-400 hover:text-gray-500">
                  Privacy Policy
                </a>
              </Link>
              <Link href="/contact">
                <a className="text-gray-400 hover:text-gray-500">
                  Contact
                </a>
              </Link>
            </div>
          </div>
          <div className="mt-4 md:mt-0">
            <p className="text-center text-base text-gray-400">&copy; {new Date().getFullYear()} Trilogy Digital Media. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
