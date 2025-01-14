'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSignOutAlt, FaArrowLeft, FaUsers, FaBox, FaEdit, FaTrash, FaPlus, FaTimes } from 'react-icons/fa';

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
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', is_admin: false });
  const { user, api, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    try {
      const [usersRes, productsRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/products')
      ]);
      setUsers(usersRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      toast.error('Gagal mengambil data');
      console.error('Fetch error:', error);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/admin/users', newUser);
      setUsers([...users, response.data]);
      setNewUser({ username: '', password: '', is_admin: false });
      toast.success('Pengguna berhasil ditambahkan');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal menambahkan pengguna');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/api/admin/users/${editingUser.id}`, editingUser);
      setUsers(users.map(u => u.id === editingUser.id ? response.data : u));
      setEditingUser(null);
      toast.success('Pengguna berhasil diperbarui');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Gagal memperbarui pengguna');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;
    try {
      console.log('Deleting user:', userId);
      const response = await api.delete(`/api/admin/users/${userId}`);
      if (response.data.message) {
        setUsers(users.filter(u => u.id !== userId));
        toast.success('Pengguna berhasil dihapus');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.error || 'Gagal menghapus pengguna');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    try {
      console.log('Deleting product:', productId);
      const response = await api.delete(`/api/admin/products/${productId}`);
      if (response.data.message) {
        setProducts(products.filter(p => p.id !== productId));
        toast.success('Produk berhasil dihapus');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(error.response?.data?.error || 'Gagal menghapus produk');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg">
                <FaCashRegister className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">KasirKuy Admin</h1>
            </div>
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 w-full sm:w-auto justify-center"
              >
                <FaArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Dashboard
              </button>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 w-full sm:w-auto justify-center"
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
            
            {/* Add/Edit User Form */}
            {editingUser ? (
              <form onSubmit={handleUpdateUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <input
                  type="text"
                  placeholder="Nama Pengguna"
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  required
                />
                <input
                  type="password"
                  placeholder="Kata Sandi Baru (opsional)"
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                />
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={editingUser.is_admin}
                      onChange={(e) => setEditingUser({ ...editingUser, is_admin: e.target.checked })}
                      className="rounded text-gray-800 focus:ring-gray-400"
                    />
                    <span className="text-gray-700">Admin</span>
                  </label>
                  <div className="flex-1 flex space-x-2">
                    <button
                      type="submit"
                      className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                    >
                      Perbarui
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                <input
                  type="text"
                  placeholder="Nama Pengguna"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  required
                />
                <input
                  type="password"
                  placeholder="Kata Sandi"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  required
                />
                <div className="flex items-center space-x-4">
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
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                  >
                    <FaPlus className="w-4 h-4 mr-2" />
                    Tambah
                  </button>
                </div>
              </form>
            )}

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Nama Pengguna</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Role</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{user.username}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {user.is_admin ? 'Admin' : 'User'}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
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
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatToRupiah(product.price)}
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