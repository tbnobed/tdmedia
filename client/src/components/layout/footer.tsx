import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
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
          <div className="mt-8 md:mt-0">
            <p className="text-center text-base text-gray-400">&copy; {new Date().getFullYear()} SecureMedia CMS. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
