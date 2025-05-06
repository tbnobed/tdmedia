/**
 * Trilogy Digital Media Configuration
 * This file is loaded dynamically and provides runtime configuration for the application.
 * In a Docker deployment environment, this file can be replaced with environment-specific settings.
 */
window.TRILOGY_CONFIG = {
  apiBaseUrl: '',  // Empty string means use the same domain as the app (relative paths)
  version: '1.0.0',
  features: {
    analytics: false,
    darkMode: true
  }
};

// For any deployment (including Docker)
const protocol = window.location.protocol;
const hostname = window.location.hostname;
const port = window.location.port ? `:${window.location.port}` : '';

// Set the API base URL to the current origin (protocol + hostname + port)
window.TRILOGY_CONFIG.apiBaseUrl = `${protocol}//${hostname}${port}`;

console.log('API Base URL configured as:', window.TRILOGY_CONFIG.apiBaseUrl);