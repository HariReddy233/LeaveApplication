import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  timeout: 30000, // 30 second timeout for database queries
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  // Get token from localStorage (browser) or cookies (SSR)
  let token: string | null = null;
  
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('auth_token');
  }
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  return config;
});

// Handle token expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect on 401 (unauthorized) - not on 403 (forbidden)
    // 403 means user doesn't have permission, but they're still authenticated
    if (error.response?.status === 401) {
      // Check if this is a calendar request or we're on calendar page - don't redirect
      const url = error.config?.url || '';
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const isCalendarRequest = url.includes('/Calendar/') || url.includes('/calendar/');
      const isCalendarPage = currentPath.includes('/calendar');
      
      if (isCalendarRequest || isCalendarPage) {
        // Don't redirect for calendar endpoints/pages - let component handle it
        return Promise.reject(error);
      }
      
      // Don't redirect if we're already on login page or if it's a login request
      if (currentPath === '/login' || currentPath.startsWith('/login') || url.includes('/Auth/LoginUser')) {
        return Promise.reject(error);
      }
      
      // Token expired or invalid - clear it and redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        // Only redirect if we're not already on the login page
        if (window.location.pathname !== '/login' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    // For 403 errors, let the component handle it (don't redirect)
    return Promise.reject(error);
  }
);

export default api;

