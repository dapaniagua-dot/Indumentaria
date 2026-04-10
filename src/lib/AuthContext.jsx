import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if system needs initial setup
      const statusRes = await fetch('/api/auth/status');
      const statusData = await statusRes.json();
      if (statusData.needsSetup) {
        setNeedsSetup(true);
        setIsLoadingAuth(false);
        return;
      }

      // Try to validate existing token
      const savedToken = localStorage.getItem('token');
      if (!savedToken) {
        setIsLoadingAuth(false);
        return;
      }

      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` },
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(savedToken);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = (userData, newToken) => {
    setUser(userData);
    setToken(newToken);
    setIsAuthenticated(true);
    setNeedsSetup(false);
    localStorage.setItem('token', newToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('token');
  };

  const navigateToLogin = () => {
    // No-op, handled by App.jsx rendering Login
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      needsSetup,
      login,
      logout,
      navigateToLogin,
      checkAppState: checkAuth,
      appPublicSettings: {},
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
