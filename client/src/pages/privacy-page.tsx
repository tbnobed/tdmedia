import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
          
          <div className="prose prose-green max-w-none">
            <p className="lead">At Trilogy Digital Media, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.</p>
            
            <h2>1. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul>
              <li><strong>Personal Information</strong>: Such as your name, email address, and contact details when you create an account.</li>
              <li><strong>Usage Data</strong>: Information about how you use our service, including which content you access and how long you view it.</li>
              <li><strong>Log Data</strong>: Standard information sent by your browser, such as IP address, browser type, and pages visited.</li>
            </ul>
            
            <h2>2. How We Use Your Information</h2>
            <p>We use your information for the following purposes:</p>
            <ul>
              <li>To provide and maintain our service</li>
              <li>To notify you about changes to our service</li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information to improve our service</li>
              <li>To monitor the usage of our service</li>
              <li>To detect, prevent and address technical issues</li>
            </ul>
            
            <h2>3. Data Security</h2>
            <p>We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure. We strive to use commercially acceptable means to protect your personal data.</p>
            
            <h2>4. Third-Party Services</h2>
            <p>Our service may contain links to other websites or services that are not operated by us. If you click on a third-party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit.</p>
            
            <h2>5. Content Access Logging</h2>
            <p>For security purposes, we log all content access within our platform. This includes information about when and how content is viewed. This information may be used to investigate unauthorized access attempts or violations of our Terms of Service.</p>
            
            <h2>6. Your Data Rights</h2>
            <p>Depending on your location, you may have certain rights regarding your personal information, such as:</p>
            <ul>
              <li>The right to access information we have about you</li>
              <li>The right to request correction of your personal information</li>
              <li>The right to request deletion of your personal information</li>
              <li>The right to object to processing of your personal information</li>
            </ul>
            
            <h2>7. Children's Privacy</h2>
            <p>Our service does not address anyone under the age of 18. We do not knowingly collect personally identifiable information from anyone under 18 years of age.</p>
            
            <h2>8. Changes to This Privacy Policy</h2>
            <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.</p>
            
            <h2>9. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at privacy@trilogydigitalmedia.com</p>
            
            <p className="mt-8 text-sm text-gray-500">Last updated: May 7, 2025</p>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}