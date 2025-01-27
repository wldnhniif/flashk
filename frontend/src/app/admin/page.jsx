'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSignOutAlt, FaArrowLeft, FaUsers, FaBox, FaTrash, FaPlus } from 'react-icons/fa';

const DEFAULT_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTkgM0g1QzMuODk1NDMgMyAzIDMuODk1NDMgMyA1VjE5QzMgMjAuMTA0NiAzLjg5NTQzIDIxIDUgMjFIMTlDMjAuMTA0NiAyMSAyMSAyMC4xMDQ2IDIxIDE5VjVDMjEgMy44OTU0MyAyMC4xMDQ2IDMgMTkgM1pNNSA1SDE5VjE5SDVWNVpNMTUuNSA5QzE1LjUgMTAuMzgwNyAxNC4zODA3IDExLjUgMTMgMTEuNUMxMS42MTkzIDExLjUgMTAuNSAxMC4zODA3IDEwLjUgOUMxMC41IDcuNjE5MjkgMTEuNjE5MyA2LjUgMTMgNi41QzE0LjM4MDcgNi41IDE1LjUgNy42MTkyOSAxNS41IDlaTTYgMTdWMTZMMTAgMTJMMTEuNSAxMy41TDE1LjUgOS41TDE4IDEyVjE3SDZaIiBmaWxsPSIjOTA5MDkwIi8+PC9zdmc+';

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
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState(new Set());
  const { user, api, logout } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!user?.is_admin) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, productsRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/products')
      ]);

      if (Array.isArray(usersRes.data)) {
        setUsers(usersRes.data);
      } else {
        console.error('Invalid users data:', usersRes.data);
        toast.error('Format data pengguna tidak valid');
      }

      if (Array.isArray(productsRes.data)) {
        setProducts(productsRes.data);
      } else {
        console.error('Invalid products data:', productsRes.data);
        toast.error('Format data produk tidak valid');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Gagal mengambil data');
      if (error.response?.status === 401 || error.response?.status === 403) {
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password) {
      toast.error('Username dan password harus diisi');
      return;
    }

    try {
      await api.post('/api/admin/users', newUser);
      setNewUser({ username: '', password: '', is_admin: false });
      toast.success('Pengguna berhasil ditambahkan');
      fetchData();
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error(error.response?.data?.message || 'Gagal menambahkan pengguna');
    }
  };

  const handleDeleteUser = async (userId) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const adminCount = users.filter(u => u.is_admin).length;
    if (targetUser.is_admin && adminCount <= 1) {
      toast.error('Tidak dapat menghapus admin terakhir');
      return;
    }

    if (!window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) return;

    try {
      await api.delete(`/api/admin/users/${userId}`);
      toast.success('Pengguna berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Gagal menghapus pengguna');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;

    try {
      await api.delete(`/api/admin/products/${productId}`);
      toast.success('Produk berhasil dihapus');
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk');
    }
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header for mobile */}
      <header className="sticky top-0 z-20 bg-blue-600 text-white md:hidden">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <FaCashRegister className="w-8 h-8" />
            <span className="ml-3 text-xl font-bold">KasirKuy</span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-blue-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
        
        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg">
            <nav className="px-4 py-2">
              <button
                onClick={() => {
                  router.push('/dashboard');
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <FaArrowLeft className="w-5 h-5" />
                <span className="ml-3">Kembali ke Kasir</span>
              </button>
              <button
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center w-full px-4 py-2 mt-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <FaSignOutAlt className="w-5 h-5" />
                <span className="ml-3">Keluar</span>
              </button>
            </nav>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Hidden on mobile */}
        <aside className="hidden md:block w-64 flex-shrink-0 bg-white shadow-sm">
          <div className="flex items-center h-16 px-6 bg-blue-600">
            <FaCashRegister className="w-8 h-8 text-white" />
            <span className="ml-3 text-xl font-bold text-white">KasirKuy</span>
          </div>
          <nav className="p-4">
            <div className="space-y-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center w-full px-4 py-2.5 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <FaArrowLeft className="w-5 h-5" />
                <span className="ml-3">Kembali ke Kasir</span>
              </button>
              <button
                onClick={logout}
                className="flex items-center w-full px-4 py-2.5 text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-200"
              >
                <FaSignOutAlt className="w-5 h-5" />
                <span className="ml-3">Keluar</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Content Header */}
          <div className="sticky top-0 z-10 bg-white shadow-sm">
            <div className="flex items-center justify-between h-16 px-4 md:px-6">
              <h1 className="text-xl md:text-2xl font-bold text-gray-800">Dashboard Admin</h1>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-xl shadow-sm">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <FaUsers className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <h2 className="text-sm md:text-base font-semibold text-gray-600">Total Pengguna</h2>
                    <p className="text-lg md:text-2xl font-bold text-gray-800">{users.length}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white rounded-xl shadow-sm">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <FaBox className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                  </div>
                  <div className="ml-3 md:ml-4">
                    <h2 className="text-sm md:text-base font-semibold text-gray-600">Total Produk</h2>
                    <p className="text-lg md:text-2xl font-bold text-gray-800">{products.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* User Management */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">Manajemen Pengguna</h2>
                
                {/* Add User Form */}
                <form onSubmit={handleAddUser} className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-1 gap-4">
                    <input
                      type="text"
                      placeholder="Nama Pengguna"
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <input
                      type="password"
                      placeholder="Kata Sandi"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={newUser.is_admin}
                          onChange={(e) => setNewUser({ ...newUser, is_admin: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-gray-700">Admin</span>
                      </label>
                      <button
                        type="submit"
                        className="flex items-center justify-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                      >
                        <FaPlus className="w-4 h-4 mr-2" />
                        Tambah
                      </button>
                    </div>
                  </div>
                </form>

                {/* Users Table */}
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama Pengguna</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{user.username}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                user.is_admin ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.is_admin ? 'Admin' : 'User'}
                              </span>
                            </td>
                            <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString('id-ID')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
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
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 md:p-6">
                <h2 className="text-lg md:text-xl font-bold text-gray-800 mb-4">Daftar Produk</h2>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gambar</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga</th>
                          <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pemilik</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {products.map((product) => (
                          <tr key={product.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="w-10 h-10 md:w-12 md:h-12 relative rounded-lg overflow-hidden">
                                {product.image_url ? (
                                  <img
                                    src={`${process.env.NEXT_PUBLIC_API_URL}/api/uploads/${product.image_url}`}
                                    alt={product.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.src = DEFAULT_IMAGE;
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                    <img 
                                      src={DEFAULT_IMAGE}
                                      alt="placeholder"
                                      className="w-5 h-5 text-gray-400"
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{product.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatToRupiah(product.price)}</td>
                            <td className="hidden md:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">{product.user_name}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
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
        </main>
      </div>
    </div>
  );
} 