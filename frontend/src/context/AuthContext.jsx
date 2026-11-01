import React, { createContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to determine role from current URL path
  const getExpectedRoleFromPath = () => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/driver')) return 'DRIVER';
    if (path.includes('/customer')) return 'CUSTOMER';
    if (path.includes('/owner')) return 'OWNER';
    return null;
  };

  const getScopedToken = () => {
    if (typeof window === 'undefined') return null;

    // 1. Check tab's private sessionStorage first
    let token = sessionStorage.getItem('routexai_token');
    if (token) return token;

    // 2. If tab has no token yet, inspect current path role
    const expectedRole = getExpectedRoleFromPath();
    if (expectedRole) {
      token = localStorage.getItem(`routexai_token_${expectedRole}`);
      if (token) {
        sessionStorage.setItem('routexai_token', token);
        sessionStorage.setItem('routexai_role', expectedRole);
        return token;
      }
    }

    // 3. Fallback to active role or general token
    const activeRole = localStorage.getItem('routexai_active_role');
    if (activeRole) {
      token = localStorage.getItem(`routexai_token_${activeRole}`);
      if (token) {
        sessionStorage.setItem('routexai_token', token);
        sessionStorage.setItem('routexai_role', activeRole);
        return token;
      }
    }

    token = localStorage.getItem('routexai_token');
    if (token) {
      sessionStorage.setItem('routexai_token', token);
      return token;
    }

    return null;
  };

  const checkLoggedIn = useCallback(async () => {
    const token = getScopedToken();
    if (token) {
      try {
        const res = await axiosInstance.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data?.success && res.data?.data?.user) {
          const fetchedUser = res.data.data.user;
          fetchedUser.token = token;
          setUser(fetchedUser);
          sessionStorage.setItem('routexai_token', token);
          if (fetchedUser.role) {
            sessionStorage.setItem('routexai_role', fetchedUser.role);
            localStorage.setItem(`routexai_token_${fetchedUser.role}`, token);
          }
        } else {
          sessionStorage.removeItem('routexai_token');
          sessionStorage.removeItem('routexai_role');
          setUser(null);
        }
      } catch (error) {
        console.warn('[RouteXAI Auth] Session verification failed, clearing token:', error.message);
        sessionStorage.removeItem('routexai_token');
        sessionStorage.removeItem('routexai_role');
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkLoggedIn();
  }, [checkLoggedIn]);

  const login = async (email, password) => {
    const res = await axiosInstance.post('/auth/login', { email, password });
    if (res.data.success) {
      const userData = res.data.data;
      const role = (userData.role || '').toUpperCase();
      // Tab-isolated session
      sessionStorage.setItem('routexai_token', userData.token);
      sessionStorage.setItem('routexai_role', role);
      // Role-scoped storage so multi-tab testing works across roles
      localStorage.setItem(`routexai_token_${role}`, userData.token);
      localStorage.setItem('routexai_active_role', role);
      localStorage.setItem('routexai_token', userData.token);
      setUser(userData);
      return userData;
    }
  };

  const register = async (formData) => {
    const res = await axiosInstance.post('/auth/register', formData);
    if (res.data.success) {
      const userData = res.data.data;
      const role = (userData.role || '').toUpperCase();
      sessionStorage.setItem('routexai_token', userData.token);
      sessionStorage.setItem('routexai_role', role);
      localStorage.setItem(`routexai_token_${role}`, userData.token);
      localStorage.setItem('routexai_active_role', role);
      localStorage.setItem('routexai_token', userData.token);
      setUser(userData);
      return userData;
    }
  };

  const logout = () => {
    if (user?.role) {
      localStorage.removeItem(`routexai_token_${user.role}`);
    }
    sessionStorage.removeItem('routexai_token');
    sessionStorage.removeItem('routexai_role');
    localStorage.removeItem('routexai_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};
