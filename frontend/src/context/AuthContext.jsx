'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useRouter } from 'next/router';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Create axios instance with default config
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
    timeout: 30000, // 30 second timeout
  });

  // Add response interceptor to handle 401 responses
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error?.response?.status === 401) {
        // Clear user data and cookie
        setUser(null);
        Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, {
          path: '/',
          domain: window.location.hostname,
          secure: true,
          sameSite: 'None'
        });
      }
      return Promise.reject(error);
    }
  );

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get('/api/me');
        setUser(response.data.user);
      } catch (error) {
        setUser(null);
        // Only redirect if not already on login page
        if (window.location.pathname !== '/') {
          router.push('/');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/login', { username, password });
      setUser(response.data.user);
      toast.success('Berhasil masuk');
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, password) => {
    try {
      const response = await api.post('/api/register', { username, password });
      toast.success('Berhasil mendaftar');
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/logout');
      setUser(null);
      Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, {
        path: '/',
        domain: window.location.hostname,
        secure: true,
        sameSite: 'None'
      });
      toast.success('Berhasil keluar');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    api
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 