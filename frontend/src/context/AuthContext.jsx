'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: false
  });

  // Add request interceptor to include token
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log('Making request:', config.url);
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
      // Handle 401 Unauthorized
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        setUser(null);
      }
      
      // Extract error message
      let errorMessage;
      if (error.response?.status === 401) {
        errorMessage = 'Nama pengguna atau kata sandi salah';
      } else if (error.response?.status === 409) {
        errorMessage = 'Nama pengguna sudah digunakan';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('Network Error')) {
        errorMessage = error.message;
      } else {
        errorMessage = 'Terjadi kesalahan. Silakan coba lagi.';
      }
                          
      return Promise.reject({
        error: errorMessage,
        status: error.response?.status
      });
    }
  );

  const login = async (username, password) => {
    try {
      const response = await api.post('/api/login', { username, password });
      const { access_token, user } = response.data;
      
      localStorage.setItem('token', access_token);
      setUser({
        id: user.id,
        username: user.username,
        is_admin: user.is_admin
      });
      
      return true;
    } catch (error) {
      throw error?.error || 'Gagal masuk. Silakan coba lagi.';
    }
  };

  const register = async (username, password) => {
    try {
      const response = await api.post('/api/register', { username, password });
      
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      setUser({
        id: user.id,
        username: user.username,
        is_admin: user.is_admin
      });
      
      return true;
    } catch (error) {
      throw error?.error || 'Pendaftaran gagal. Silakan coba lagi.';
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user data
      api.get('/api/verify')
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem('token');
          setUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 