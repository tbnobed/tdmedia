import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
          
          <div className="prose prose-green max-w-none">
            <h2>1. Introduction</h2>
            <p>Welcome to Trilogy Digital Media. These Terms of Service govern your use of our website and services. By accessing or using our service, you agree to be bound by these Terms.</p>
            
            <h2>2. Definitions</h2>
            <p><strong>Company</strong> (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to Trilogy Digital Media.</p>
            <p><strong>Service</strong> refers to the website and all content delivery systems.</p>
            <p><strong>Content</strong> refers to any media including but not limited to videos, documents, presentations, and images delivered through our Service.</p>
            <p><strong>User</strong> means an individual who has access to use our Service.</p>
            
            <h2>3. Use of Service</h2>
            <p>Trilogy Digital Media provides a platform for secure content delivery and preview. All content is provided with digital watermarks and is intended for preview purposes only. Downloading, copying, or redistribution of any content is strictly prohibited.</p>
            
            <h2>4. User Accounts</h2>
            <p>When you create an account with us, you must provide accurate and complete information. You are responsible for safeguarding the password and for all activities that occur under your account.</p>
            
            <h2>5. Content Rights</h2>
            <p>All content provided through our service is owned by Trilogy Digital Media or our content partners. Viewing rights do not transfer ownership or imply any license to use the content outside of the service.</p>
            
            <h2>6. Prohibited Activities</h2>
            <p>You may not:</p>
            <ul>
              <li>Use any technology to download, capture, or record content from our service</li>
              <li>Remove or obscure any watermarks from the content</li>
              <li>Share your account credentials with others</li>
              <li>Use the service for any illegal purpose</li>
              <li>Attempt to reverse engineer any part of the service</li>
            </ul>
            
            <h2>7. Termination</h2>
            <p>We may terminate or suspend your account immediately, without prior notice or liability, for any reason, including without limitation if you breach the Terms.</p>
            
            <h2>8. Limitation of Liability</h2>
            <p>In no event shall Trilogy Digital Media be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of the service.</p>
            
            <h2>9. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. We will provide notice of any significant changes by posting the new Terms on this page.</p>
            
            <h2>10. Contact Us</h2>
            <p>If you have any questions about these Terms, please contact us at support@trilogydigitalmedia.com</p>
            
            <p className="mt-8 text-sm text-gray-500">Last updated: May 7, 2025</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}