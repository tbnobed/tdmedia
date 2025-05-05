// Default configuration for Trilogy Digital Media
window.TRILOGY_CONFIG = {
  // Development environment API URL
  apiBaseUrl: '',
  
  // Other configuration options
  version: '1.0.0',
  features: {
    analytics: false,
    darkMode: false
  }
};

// Add a startup check for debugging
(function() {
  console.log('TRILOGY_CONFIG loaded successfully:', window.TRILOGY_CONFIG);
  window.addEventListener('load', function() {
    console.log('Window loaded event fired');
    
    // Check if we're in the Docker environment
    if (document.location.hostname.includes('obedtv.live')) {
      console.log('Running in Docker environment - special handling may be needed');
    }
    
    // If the app doesn't render within 3 seconds, show a message
    setTimeout(function() {
      if (document.getElementById('root') && 
          document.getElementById('root').childElementCount <= 1) {
        console.warn('Application may not have rendered correctly. Check for errors.');
      } else {
        console.log('Application appears to be rendering correctly');
      }
    }, 3000);
  });
})();