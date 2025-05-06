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

// For Docker deployment with different domain/port
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  // If served from a different domain in production, we can update the config
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // In production Docker setup, the API is on the same domain
  window.TRILOGY_CONFIG.apiBaseUrl = `${protocol}//${hostname}`;
}