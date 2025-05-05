// Global type declarations

interface TrilogyConfig {
  apiBaseUrl: string;
  version: string;
  features: {
    analytics: boolean;
    darkMode: boolean;
  };
}

interface Window {
  TRILOGY_CONFIG?: TrilogyConfig;
}