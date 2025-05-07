interface TBNConfig {
  apiBaseUrl: string;
  version: string;
  features: {
    analytics: boolean;
    darkMode: boolean;
  };
}

declare global {
  interface Window {
    TBN_CONFIG: TBNConfig;
    TRILOGY_CONFIG: TBNConfig; // For backward compatibility
  }
}

export {};