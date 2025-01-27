'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FaCashRegister, FaUser, FaLock, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-hot-toast';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Username dan password harus diisi');
      return;
    }
    setIsLoading(true);
    try {
      await register(username, password);
      router.push('/dashboard');
    } catch (error) {
      console.error('Register error:', error);
      toast.error(error.response?.data?.message || 'Gagal mendaftar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-600 text-white mb-4 shadow-lg">
                <FaCashRegister className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Buat Akun KasirKuy</h1>
              <p className="text-gray-600">Daftar untuk memulai</p>
            </div>
          </div>

          {/* Form Section */}
          <div className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nama Pengguna
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaUser className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-200"
                      placeholder="Pilih nama pengguna"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FaLock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow duration-200"
                      placeholder="Buat kata sandi"
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'Daftar'
                )}
              </button>

              <div className="text-center">
                <button
                  onClick={() => router.push('/')}
                  className="inline-flex items-center text-sm text-gray-600 hover:text-blue-600 focus:outline-none focus:underline transition-colors duration-200"
                >
                  <FaArrowLeft className="w-4 h-4 mr-2" />
                  Kembali ke halaman masuk
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            © 2024 KasirKuy. Dibuat oleh{' '}
            <a
              href="https://github.com/wildanhanif"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium hover:text-blue-600 transition-colors duration-200"
            >
              Wildan Hanif
            </a>
          </p>
        </div>
      </div>
    </div>
  );
} 