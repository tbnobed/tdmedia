import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Try to get detailed error message from the response
    try {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    } catch (err) {
      // If we can't parse the response, throw a generic error with status
      throw new Error(`Request failed with status ${res.status}`);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  try {
    // Use apiBaseUrl from config if available
    const baseUrl = window.TRILOGY_CONFIG?.apiBaseUrl || '';
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    
    console.log(`Making ${method} request to: ${fullUrl}`);
    
    const res = await fetch(fullUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // Network error (connection refused, network offline, etc.)
      console.error('Network error occurred:', error);
      const errorMessage = 'NetworkError when attempting to fetch resource. Please check your connection and try again. The server may be unavailable.';
      throw new Error(errorMessage);
    }
    
    // More detailed error for CORS issues
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Request aborted (possibly CORS):', error);
      throw new Error('Request was blocked. This may be due to CORS configuration issues.');
    }
    
    // Re-throw any other errors with additional logging
    console.error('API request failed:', error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const baseUrl = window.TRILOGY_CONFIG?.apiBaseUrl || '';
      const url = queryKey[0] as string;
      const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
      
      console.log(`Making GET request to: ${fullUrl}`);
      
      const res = await fetch(fullUrl, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        // Network error (connection refused, network offline, etc.)
        console.error('Network error occurred:', error);
        const errorMessage = 'NetworkError when attempting to fetch resource. Please check your connection and try again. The server may be unavailable.';
        throw new Error(errorMessage);
      }
      
      // More detailed error for CORS issues
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Request aborted (possibly CORS):', error);
        throw new Error('Request was blocked. This may be due to CORS configuration issues.');
      }
      
      // Re-throw any other errors with additional logging
      console.error('API request failed:', error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
