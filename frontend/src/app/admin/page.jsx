'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSignOutAlt, FaArrowLeft, FaUsers, FaBox, FaEdit, FaTrash, FaPlus, FaTimes, FaCheck } from 'react-icons/fa';

const formatToRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
};

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false });
  const [editingUser, setEditingUser] = useState(null);
  const { user, api, logout } = useAuth();
  const router = useRouter();

  // Check if user is admin
  useEffect(() => {
    if (!user?.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, router, api]);

  const fetchData = async () => {
    try {
      // Add loading state if needed
      const [usersRes, productsRes] = await Promise.all([
        api.get('/api/admin/users'),  // Changed endpoint
        api.get('/api/admin/products')  // Changed endpoint
      ]);

      console.log('Users response:', usersRes.data);  // Debug log
      console.log('Products response:', productsRes.data);  // Debug log

      // Set the data directly since the admin endpoints return arrays
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
    } catch (error) {
      console.error('Error fetching data:', error.response || error);
      toast.error(error.response?.data?.message || 'Gagal mengambil data');
      // If unauthorized, redirect to dashboard
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/dashboard');
      }
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password) {
      toast.error('Username dan password harus diisi');
      return;
    }

    try {
      await api.post('/api/users', newUser);
      setNewUser({ username: '', password: '', is_admin: false });
      toast.success('Pengguna berhasil ditambahkan');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error(error.response?.data?.message || 'Gagal menambahkan pengguna');
    }
  };

  const handleUpdateUser = async (userId, updatedData) => {
    if (!updatedData.username.trim()) {
      toast.error('Username tidak boleh kosong');
      return;
    }

    try {
      await api.put(`/api/users/${userId}`, updatedData);
      toast.success('Pengguna berhasil diperbarui');
      fetchData(); // Refresh data
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error.response?.data?.message || 'Gagal memperbarui pengguna');
    }
  };

  const handleDeleteUser = async (userId) => {
    // Prevent deleting the last admin
    const isLastAdmin = users.filter(u => u.is_admin).length === 1 && 
                       users.find(u => u.id === userId)?.is_admin;
    
    if (isLastAdmin) {
      toast.error('Tidak dapat menghapus admin terakhir');
      return;
    }

    if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;
    
    try {
      await api.delete(`/api/users/${userId}`);
      toast.success('Pengguna berhasil dihapus');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.message || 'Gagal menghapus pengguna');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    
    try {
      await api.delete(`/api/products/${productId}`);
      toast.success('Produk berhasil dihapus');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(error.response?.data?.message || 'Gagal menghapus produk');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Gagal keluar. Silakan coba lagi.');
    }
  };

  // Show loading state while checking authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg">
                <FaCashRegister className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-800">KasirKuy Admin</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                <FaArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                <FaSignOutAlt className="w-4 h-4 mr-2" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Total Pengguna</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{users.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <FaUsers className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Total Produk</h3>
                <p className="text-3xl font-bold text-gray-900 mt-2">{products.length}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <FaBox className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* User Management Section */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Manajemen Pengguna</h2>
            
            {/* Add User Form */}
            <form onSubmit={handleAddUser} className="mb-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nama Pengguna"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 text-gray-900"
                  required
                />
                <input
                  type="password"
                  placeholder="Kata Sandi"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 text-gray-900"
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={newUser.is_admin}
                    onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                    className="rounded text-gray-800 focus:ring-gray-400"
                  />
                  <span className="text-gray-700">Admin</span>
                </label>
                <button
                  type="submit"
                  className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                >
                  <FaPlus className="w-4 h-4 mr-2" />
                  Tambah
                </button>
              </div>
            </form>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Nama Pengguna</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Role</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tanggal Dibuat</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {editingUser?.id === user.id ? (
                          <input
                            type="text"
                            value={editingUser.username}
                            onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 text-gray-900 w-full"
                          />
                        ) : (
                          user.username
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {editingUser?.id === user.id ? (
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editingUser.is_admin}
                              onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.checked })}
                              className="rounded text-gray-800 focus:ring-gray-400"
                            />
                            <span className="text-gray-700">Admin</span>
                          </label>
                        ) : (
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            user.is_admin ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.is_admin ? 'Admin' : 'User'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(user.created_at).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {editingUser?.id === user.id ? (
                          <>
                            <button
                              onClick={() => handleUpdateUser(user.id, editingUser)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <FaCheck className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              <FaTimes className="w-4 h-4 inline" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingUser(user)}
                              className="text-gray-600 hover:text-gray-800"
                            >
                              <FaEdit className="w-4 h-4 inline" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-800"
                              disabled={user.is_admin && users.filter(u => u.is_admin).length === 1}
                            >
                              <FaTrash className="w-4 h-4 inline" />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Daftar Produk</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Nama Produk</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Harga</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Dibuat Oleh</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Tanggal Dibuat</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex items-center space-x-3">
                          {product.image_url ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}${product.image_url}`}
                              alt={product.name}
                              className="w-8 h-8 rounded-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = '/placeholder.png';
                              }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                              <FaBox className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <span>{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatToRupiah(product.price)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {product.user_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(product.created_at).toLocaleDateString('id-ID', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <FaTrash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 