'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSpinner, FaUser, FaLock, FaSignInAlt, FaUserPlus } from 'react-icons/fa';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
        toast.success('Login successful!');
        router.push('/dashboard');
      } else {
        console.log('Starting registration process...');
        await register(username, password);
        console.log('Registration completed successfully');
        toast.success('Registration successful! Please login.');
        setIsLogin(true);
        setUsername('');
        setPassword('');
      }
    } catch (error) {
      console.error('Form submission error:', error);
      let errorMessage = 'Authentication failed. Please try again.';
      
      if (typeof error === 'string') {
        errorMessage = error;
      } else if (error?.error) {
        errorMessage = error.error;
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      console.log('Displaying error:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-4 rounded-full shadow-lg transform hover:scale-105 transition-transform duration-300">
              <FaCashRegister className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-2 font-sans">KasirKuy</h1>
          <p className="text-gray-600">
            {isLogin ? 'Sign in to manage your store' : 'Create an account to get started'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 transition-all duration-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaUser className="h-5 w-5 text-gray-400 group-hover:text-gray-500 transition-colors duration-200" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 transition-all duration-200"
                  placeholder="Enter your username"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaLock className="h-5 w-5 text-gray-400 group-hover:text-gray-500 transition-colors duration-200" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 text-gray-900 transition-all duration-200"
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-300 transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <FaSpinner className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                <>
                  <FaSignInAlt className="w-5 h-5 mr-2" />
                  Sign In
                </>
              ) : (
                <>
                  <FaUserPlus className="w-5 h-5 mr-2" />
                  Register
                </>
              )}
            </button>
          </form>

          {/* Toggle Button */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setUsername('');
                setPassword('');
              }}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium focus:outline-none transition-colors duration-200"
            >
              {isLogin ? "Don't have an account? Register" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>© 2024 KasirKuy. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
} 