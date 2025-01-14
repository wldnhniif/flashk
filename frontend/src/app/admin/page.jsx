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
      <nav className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg">
                <FaCashRegister className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-800">KasirKuy Admin</h1>
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
                onClick={() => {
                  logout();
                  router.push('/');
                }}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
            {!editingUser && (
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  placeholder="Password"
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
                    Tambah Pengguna
                  </button>
                </div>
              </form>
            )}

            {/* Edit User Form */}
            {editingUser && (
              <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                  >
                    Perbarui Pengguna
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    <FaTimes className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Pengguna</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Peran</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat Pada</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.is_admin ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          {u.is_admin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.products_count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setEditingUser(u)}
                          className="text-gray-600 hover:text-gray-900 mr-3"
                        >
                          <FaEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={u.is_admin && users.filter(user => user.is_admin).length === 1}
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

        {/* Products Section */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Ringkasan Produk</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produk</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pemilik</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {p.image_url ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${p.image_url}`}
                              alt={p.name}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                              <FaBox className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{p.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatToRupiah(p.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.user_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="text-red-600 hover:text-red-900"
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