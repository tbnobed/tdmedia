// Docker-specific configuration for Trilogy Digital Media
window.TRILOGY_CONFIG = {
  // API URL from environment - empty string because we're serving from the same origin
  apiBaseUrl: '',
  
  // Application version
  version: '1.0.0',
  
  // Feature flags
  features: {
    analytics: false,
    darkMode: false
  }
};

console.log('Docker config loaded for Trilogy Digital Media');