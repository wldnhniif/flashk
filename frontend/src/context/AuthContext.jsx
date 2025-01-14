'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Cookies from 'js-cookie';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: true
  });

  // Add request interceptor to include token from cookie
  api.interceptors.request.use((config) => {
    const token = Cookies.get(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME || 'kasirkuy_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }, (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  });

  // Add response interceptor to handle errors
  api.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      console.error('Response error:', error);
      
      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME || 'kasirkuy_auth_token', { 
          path: '/',
          domain: window.location.hostname
        });
        setUser(null);
      }
      
      // Extract error message
      let errorMessage;
      if (error.response?.status === 401) {
        errorMessage = 'Nama pengguna atau kata sandi salah';
      } else if (error.response?.status === 409) {
        errorMessage = error.response.data.message || 'Konflik data';
      } else if (error.response?.status === 0 || !error.response) {
        errorMessage = 'Tidak dapat terhubung ke server. Mohon coba lagi nanti.';
      } else {
        errorMessage = error.response?.data?.message || 'Terjadi kesalahan';
      }
      
      toast.error(errorMessage);
      return Promise.reject(error);
    }
  );

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/login', { username, password });
      const { token, user: userData } = response.data;
      
      if (!token || !userData) {
        throw new Error('Invalid response from server');
      }
      
      // Store token in cookie
      Cookies.set(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME || 'kasirkuy_auth_token', token, {
        expires: 7, // 7 days
        secure: true,
        sameSite: 'None',
        path: '/',
        domain: window.location.hostname
      });
      
      setUser(userData);
      toast.success('Login berhasil');
      return userData;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      Cookies.remove(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME);
      setUser(null);
    }
  };

  const checkAuth = async () => {
    try {
      const token = Cookies.get(process.env.NEXT_PUBLIC_JWT_COOKIE_NAME);
      if (!token) {
        setUser(null);
        return;
      }

      const response = await api.get('/api/verify');
      setUser(response.data);
    } catch (error) {
      console.error('Check auth error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const register = async (username, password) => {
    try {
      const response = await api.post('/api/register', { username, password });
      
      if (response.status === 201) {
        toast.success('Registrasi berhasil, silakan login');
        return true;
      }
      return false;
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('Nama pengguna sudah digunakan');
      } else {
        toast.error('Gagal mendaftar. Silakan coba lagi.');
      }
      console.error('Register error:', error);
      throw error;
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, api }}>
      {children}
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