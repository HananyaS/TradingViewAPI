/**
 * API utility functions for authenticated requests
 */

const TOKEN_KEY = 'auth_token';

/**
 * Get the authentication token from localStorage
 */
export const getAuthToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * Get headers with authentication token
 */
export const getAuthHeaders = (additionalHeaders = {}) => {
  const token = getAuthToken();
  const headers = {
    ...additionalHeaders
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

/**
 * Fetch with authentication
 */
export const fetchWithAuth = async (url, options = {}) => {
  const token = getAuthToken();
  
  const config = {
    credentials: options.credentials ?? 'include',
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };
  
  return fetch(url, config);
};

