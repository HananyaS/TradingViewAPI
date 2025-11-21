import React, { createContext, useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

const TOKEN_KEY = 'auth_token';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a token in the URL (from OAuth redirect)
    const params = new URLSearchParams(location.search);
    const tokenFromUrl = params.get('auth_token');
    
    if (tokenFromUrl) {
      console.log('🔑 Token received from OAuth!');
      localStorage.setItem(TOKEN_KEY, tokenFromUrl);
      // Remove token from URL
      navigate(location.pathname, { replace: true });
      // Check auth after setting token
      checkAuth();
    }
  }, [location.search]); // Only depend on search params, not entire location
  
  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      
      if (!token) {
        console.log('❌ No token found in localStorage');
        setUser(null);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      console.log('🔍 Checking authentication with token...');
      
      // Send token in Authorization header
      const response = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📡 /api/user response status:', response.status);
      const data = await response.json();
      console.log('📦 /api/user response data:', data);
      
      if (data.authenticated !== false) {
        console.log('✅ User authenticated:', data.email);
        setUser(data);
        setIsAuthenticated(true);
      } else {
        console.log('❌ User not authenticated (invalid token)');
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    // Redirect to Flask login
    window.location.href = '/login';
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      
      // Call Flask logout to revoke token
      await fetch('/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Remove token from localStorage
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      // Remove token anyway
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      setUser,
      loading, 
      isAuthenticated,
      login, 
      logout, 
      checkAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

