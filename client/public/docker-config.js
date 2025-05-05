// Docker-specific configuration for Trilogy Digital Media
window.TRILOGY_CONFIG = {
  // No base URL needed when served from the same origin
  apiBaseUrl: '',
  
  // Other configuration options
  version: '1.0.0',
  features: {
    analytics: false,
    darkMode: false
  }
};

// Add a startup check for debugging in Docker environment
(function() {
  console.log('DOCKER: TRILOGY_CONFIG loaded successfully:', window.TRILOGY_CONFIG);
  window.addEventListener('load', function() {
    console.log('DOCKER: Window loaded event fired');
    
    // If the app doesn't render within 3 seconds, show a message
    setTimeout(function() {
      if (document.getElementById('root') && 
          document.getElementById('root').childElementCount <= 1) {
        console.warn('DOCKER: Application may not have rendered correctly. Check for errors.');
        // Try to provide a fallback UI if the app fails to load
        var rootElement = document.getElementById('root');
        if (rootElement) {
          rootElement.innerHTML = `
            <div style="font-family: sans-serif; max-width: 500px; margin: 50px auto; text-align: center;">
              <h1>Trilogy Digital Media</h1>
              <p>There was a problem loading the application. Please try:</p>
              <ul style="text-align: left;">
                <li>Refreshing the page</li>
                <li>Clearing your browser cache</li>
                <li>Checking browser console for errors</li>
              </ul>
              <p><a href="/" style="color: blue;">Retry Loading</a></p>
            </div>
          `;
        }
      } else {
        console.log('DOCKER: Application appears to be rendering correctly');
      }
    }, 3000);
  });
})();