import React, { createContext, useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosInstance';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkLoggedIn = useCallback(async () => {
    const token = sessionStorage.getItem('routexai_token') || localStorage.getItem('routexai_token');
    if (token) {
      try {
        const res = await axiosInstance.get('/auth/me');
        if (res.data?.success && res.data?.data?.user) {
          const fetchedUser = res.data.data.user;
          fetchedUser.token = token;
          setUser(fetchedUser);
          sessionStorage.setItem('routexai_token', token);
        } else {
          sessionStorage.removeItem('routexai_token');
          localStorage.removeItem('routexai_token');
          setUser(null);
        }
      } catch (error) {
        console.warn('[RouteXAI Auth] Session verification failed, clearing token:', error.message);
        sessionStorage.removeItem('routexai_token');
        localStorage.removeItem('routexai_token');
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
      sessionStorage.setItem('routexai_token', userData.token);
      localStorage.setItem('routexai_token', userData.token);
      setUser(userData);
      return userData;
    }
  };

  const register = async (formData) => {
    const res = await axiosInstance.post('/auth/register', formData);
    if (res.data.success) {
      const userData = res.data.data;
      sessionStorage.setItem('routexai_token', userData.token);
      localStorage.setItem('routexai_token', userData.token);
      setUser(userData);
      return userData;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('routexai_token');
    localStorage.removeItem('routexai_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkLoggedIn }}>
      {children}
    </AuthContext.Provider>
  );
};
