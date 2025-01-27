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

  // Create axios instance
  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Add request interceptor
  api.interceptors.request.use(
    (config) => {
      const token = Cookies.get(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME);
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        console.log('Request interceptor - Adding token:', token);
      }
      console.log('Request config:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        withCredentials: config.withCredentials
      });
      return config;
    },
    (error) => {
      console.error('Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor
  api.interceptors.response.use(
    (response) => {
      console.log('Response interceptor - Success:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
        cookies: document.cookie
      });
      return response;
    },
    (error) => {
      console.error('Response interceptor - Error:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        cookies: document.cookie
      });
      if (error.response?.status === 401) {
        setUser(null);
        Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, { path: '/' });
        router.push('/');
      }
      return Promise.reject(error);
    }
  );

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = Cookies.get(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        console.log('Verifying token:', token);
        const response = await api.get('/api/verify');
        setUser(response.data);
      } catch (error) {
        console.error('Auth check error:', error);
        Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, { path: '/' });
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      console.log('Login attempt:', { username });
      
      // Clear any existing auth state
      setUser(null);
      Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, { path: '/' });
      
      const response = await api.post('/api/login', { 
        username, 
        password 
      });
      
      console.log('Login response:', response.data);
      
      const { token, user: userData } = response.data;
      
      // Verify we got both token and user data
      if (!token || !userData) {
        console.error('Invalid login response:', response.data);
        throw new Error('Invalid login response from server');
      }
      
      // Store token in cookie with proper configuration
      Cookies.set(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, token, {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: 7 // 7 days
      });
      
      // Update auth headers for future requests
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Set user data in state
      setUser(userData);
      
      console.log('Login successful, redirecting...');
      router.push('/dashboard');
      
      return response.data;
    } catch (error) {
      console.error('Login error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Clear any partial auth state
      setUser(null);
      Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, { path: '/' });
      delete api.defaults.headers.common['Authorization'];
      
      if (error.response?.status === 401) {
        toast.error('Username atau password salah');
      } else if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'Data login tidak valid');
      } else if (error.response?.status === 429) {
        toast.error(error.response.data.message || 'Terlalu banyak percobaan. Silakan coba lagi nanti.');
      } else {
        toast.error('Gagal masuk. Silakan coba lagi.');
      }
      
      throw error;
    }
  };

  const register = async (username, password) => {
    try {
      console.log('Register attempt:', { username });
      
      // Clear any existing auth state first
      setUser(null);
      Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, { path: '/' });
      delete api.defaults.headers.common['Authorization'];
      
      const response = await api.post('/api/register', { 
        username, 
        password 
      });
      
      console.log('Register response:', response.data);
      
      // After successful registration, automatically log them in
      const loginResponse = await api.post('/api/login', {
        username,
        password
      });

      const { token, user: userData } = loginResponse.data;
      
      if (!token || !userData) {
        console.error('Invalid login response after register:', loginResponse.data);
        throw new Error('Invalid login response from server');
      }
      
      // Store token in cookie
      Cookies.set(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, token, {
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        expires: 7 // 7 days
      });
      
      // Update auth headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Set user data
      setUser(userData);
      
      toast.success('Pendaftaran berhasil!');
      console.log('Register and login successful, redirecting...');
      router.push('/dashboard');
      
      return loginResponse.data;
    } catch (error) {
      console.error('Register error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      // Clear any partial auth state
      setUser(null);
      Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, { path: '/' });
      delete api.defaults.headers.common['Authorization'];
      
      if (error.response?.status === 400) {
        toast.error(error.response.data.message || 'Username sudah digunakan');
      } else {
        toast.error('Gagal mendaftar. Silakan coba lagi.');
      }
      
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME, { path: '/' });
      router.push('/');
    }
  };

  const value = {
    user,
    login,
    logout,
    register,
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