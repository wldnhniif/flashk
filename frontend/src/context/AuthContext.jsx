'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

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

  // Add request interceptor to add token to all requests
  api.interceptors.request.use(
    (config) => {
      const token = Cookies.get(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

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
        // Redirect to login page if not already there
        if (window.location.pathname !== '/') {
          router.push('/');
        }
      }
      return Promise.reject(error);
    }
  );

  // Check authentication status on mount and when user changes
  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME);
      if (!token) {
        setUser(null);
        setLoading(false);
        if (window.location.pathname !== '/') {
          router.push('/');
        }
        return;
      }

      try {
        const response = await api.get('/api/verify');
        setUser(response.data);
        // If we're on the login page and user is authenticated, redirect to dashboard
        if (window.location.pathname === '/') {
          router.push('/dashboard');
        }
      } catch (error) {
        setUser(null);
        Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, {
          path: '/',
          domain: window.location.hostname,
          secure: true,
          sameSite: 'None'
        });
        // Only redirect to login if not already there
        if (window.location.pathname !== '/') {
          router.push('/');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/login', { username, password });
      
      // Set the cookie with the token from the response
      Cookies.set(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, response.data.token, {
        path: '/',
        domain: window.location.hostname,
        secure: true,
        sameSite: 'None'
      });
      
      setUser(response.data.user);
      toast.success('Berhasil masuk');
      router.push('/dashboard');
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (username, password) => {
    try {
      const response = await api.post('/api/register', { username, password });
      toast.success('Berhasil mendaftar');
      return response.data;
    } catch (error) {
      console.error('Register error:', error);
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
      router.push('/');
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
    api,
    loading
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