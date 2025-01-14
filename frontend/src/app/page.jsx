'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaSpinner } from 'react-icons/fa';
import { FaCashRegister } from 'react-icons/fa';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const { login, register, user, loading } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !loading) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
        setIsLogin(true);
        setUsername('');
        setPassword('');
      }
    } catch (error) {
      console.error('Auth error:', error);
      // Convert error to user-friendly message
      let errorMessage;
      
      if (error?.response?.status === 401) {
        errorMessage = 'Nama pengguna atau kata sandi salah';
      } else if (error?.response?.status === 409) {
        errorMessage = 'Nama pengguna sudah digunakan';
      } else if (error?.response?.status === 400) {
        errorMessage = error?.response?.data?.message || 'Data tidak valid';
      } else if (error?.code === 'ERR_NETWORK') {
        errorMessage = 'Tidak dapat terhubung ke server. Mohon coba lagi nanti.';
      } else if (error?.response?.status === 500) {
        errorMessage = 'Terjadi kesalahan pada server. Mohon coba lagi nanti.';
      } else {
        errorMessage = error?.response?.data?.error || 'Terjadi kesalahan. Silakan coba lagi.';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FaSpinner className="w-8 h-8 animate-spin text-gray-800" />
      </div>
    );
  }

  // Don't show login page if already authenticated
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-3 rounded-lg mx-auto w-fit">
          <FaCashRegister className="w-12 h-12 text-white" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          KasirKuy
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                Nama Pengguna
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-black"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Kata Sandi
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-gray-500 focus:border-gray-500 text-black"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                {isLoading ? (
                  <FaSpinner className="w-5 h-5 animate-spin" />
                ) : isLogin ? (
                  'Masuk'
                ) : (
                  'Daftar'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="w-full text-center text-sm text-gray-600 hover:text-gray-800"
              disabled={isLoading}
            >
              {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
            </button>
          </div>
        </div>
        <p className="mt-8 text-center text-sm text-gray-600">
          © 2024 KasirKuy. Dibuat oleh Wildan Hanif
        </p>
      </div>
    </div>
  );
} 