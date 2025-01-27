'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSignOutAlt, FaPlus, FaShoppingCart, FaPrint, FaImage, FaEdit, FaTrash, FaBox, FaSpinner, FaTimes, FaUserCog, FaMinus } from 'react-icons/fa';
import axios from 'axios';

const formatToRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
};

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const { user, logout, api, loading } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Fetch products when user is authenticated
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        console.log('Fetching products...', {
          user: user?.id,
          headers: api.defaults.headers
        });
        
        const response = await api.get('/api/products');
        console.log('Products response:', response.data);
        
        setProducts(response.data.products || []);
      } catch (error) {
        console.error('Error fetching products:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.config?.headers,
          message: error.message
        });
        
        if (error.response?.status === 401) {
          toast.error('Session expired. Please login again.');
          logout();
        } else {
          toast.error('Failed to fetch products. Please try again.');
        }
      }
    };

    if (user) {
      fetchProducts();
    }
  }, [user, api, logout]);

  // Show loading state while checking authentication
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <FaSpinner className="w-8 h-8 animate-spin text-gray-800" />
      </div>
    );
  }

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Gagal keluar. Silakan coba lagi.');
    }
  };

  const handleAddProduct = async (formData) => {
    setIsSubmitting(true);
    try {
      console.log('Adding product with data:', {
        name: formData.get('name'),
        price: formData.get('price'),
        hasImage: formData.get('image') !== null
      });
      
      const response = await api.post('/api/products', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('Product added response:', response.data);
      
      if (!response.data || !response.data.product) {
        throw new Error('Invalid response from server');
      }
      
      setProducts([...products, response.data.product]);
      toast.success('Produk berhasil ditambahkan');
      setShowModal(false);
    } catch (error) {
      console.error('Error adding product:', error.response || error);
      toast.error(error.response?.data?.message || 'Gagal menambahkan produk');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProduct = async (formData) => {
    if (!editingProduct) return;
    
    setIsSubmitting(true);
    try {
      console.log('Editing product with data:', {
        id: editingProduct.id,
        name: formData.get('name'),
        price: formData.get('price'),
        hasImage: formData.get('image') !== null
      });
      
      const response = await api.patch(`/api/products/${editingProduct.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Product edited response:', response.data);
      
      if (!response.data || !response.data.product) {
        throw new Error('Invalid response from server');
      }

      setProducts(products.map(p => 
        p.id === editingProduct.id ? response.data.product : p
      ));
      
      toast.success('Produk berhasil diperbarui');
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error editing product:', error.response || error);
      toast.error(error.response?.data?.message || 'Gagal memperbarui produk');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus produk ini?')) return;
    
    try {
      await api.delete(`/api/products/${productId}`);
      setProducts(products.filter(p => p.id !== productId));
      toast.success('Produk berhasil dihapus');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk');
    }
  };

  const handleSubmitProduct = async (formData) => {
    try {
      if (editingProduct) {
        await handleEditProduct(formData);
      } else {
        await handleAddProduct(formData);
      }
    } catch (error) {
      console.error('Error submitting product:', error);
      toast.error('Gagal menyimpan produk');
    }
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) return;
    setCartItems(cartItems.map(item => 
      item.id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const addToCart = (product) => {
    const existingItem = cartItems.find(item => item.id === product.id);
    if (existingItem) {
      updateCartItemQuantity(product.id, existingItem.quantity + 1);
    } else {
      setCartItems([...cartItems, { ...product, quantity: 1 }]);
    }
    toast.success('Produk ditambahkan ke keranjang');
  };

  const handlePrint = async () => {
    if (cartItems.length === 0) {
      toast.error('Keranjang belanja kosong');
      return;
    }

    try {
      // Calculate total
      const total = calculateTotal();

      // Generate receipt PDF using backend API
      const response = await api.post('/api/generate-receipt', {
        items: cartItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        total: total
      });

      if (!response.data || !response.data.pdf_url) {
        throw new Error('Invalid response from server');
      }

      // Open PDF in new window
      window.open(response.data.pdf_url, '_blank');
      
      // Clear cart and show success message
      setCartItems([]);
      toast.success('Struk berhasil dicetak');
    } catch (error) {
      console.error('Error generating receipt:', error.response || error);
      toast.error('Gagal mencetak struk. Silakan coba lagi.');
    }
  };

  const calculateTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Product Card Component
  const ProductCard = ({ product, onEdit, onDelete }) => (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="relative w-full pb-[100%]">
        {product.image_url ? (
          <img
            src={`${process.env.NEXT_PUBLIC_API_URL}/api/uploads/${product.image_url}`}
            alt={product.name}
            className="absolute top-0 left-0 w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/placeholder.png';
              console.error('Failed to load image:', product.image_url);
            }}
            loading="lazy"
          />
        ) : (
          <div className="absolute top-0 left-0 w-full h-full bg-gray-100 flex items-center justify-center">
            <FaBox className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{product.name}</h3>
        <p className="text-gray-600 mb-4">{formatToRupiah(product.price)}</p>
        <div className="flex justify-between items-center">
          <button
            onClick={() => addToCart(product)}
            className="px-4 py-2 text-sm bg-gray-800 text-white rounded-md hover:bg-gray-900"
          >
            <FaShoppingCart className="w-4 h-4 inline-block mr-2" />
            Tambah
          </button>
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(product)}
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <FaEdit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(product.id)}
              className="p-2 text-red-600 hover:text-red-800 transition-colors"
            >
              <FaTrash className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Add/Edit Product Modal
  const ProductModal = ({ isOpen, onClose, onSubmit, editingProduct, isSubmitting }) => {
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [image, setImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
      if (editingProduct) {
        setName(editingProduct.name);
        setPrice(editingProduct.price.toString());
        setPreviewUrl(editingProduct.image_url ? `${process.env.NEXT_PUBLIC_API_URL}/api/uploads/${editingProduct.image_url}?t=${new Date().getTime()}` : '');
        setImage(null); // Reset image when editing
      } else {
        setName('');
        setPrice('');
        setImage(null);
        setPreviewUrl('');
      }
    }, [editingProduct]);

    const handleImageChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          toast.error('Ukuran gambar terlalu besar. Maksimal 5MB.');
          return;
        }
        if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
          toast.error('Format gambar tidak didukung. Gunakan JPG, PNG, atau GIF.');
          return;
        }
        setImage(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Validate price
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        toast.error('Harga harus lebih besar dari 0');
        return;
      }

      // Validate name
      if (!name.trim()) {
        toast.error('Nama produk harus diisi');
        return;
      }

      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('price', price);
      if (image) {
        formData.append('image', image);
      }

      try {
        await onSubmit(formData);
      } catch (error) {
        console.error('Error submitting product:', error);
        toast.error('Gagal menyimpan produk');
      }
    };

    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg w-full max-w-md">
          <div className="p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">
              {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Produk
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 text-gray-900"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harga
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 text-gray-900"
                  required
                  min="0"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gambar Produk
                </label>
                <div className="mt-1 flex items-center space-x-4">
                  <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-100">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaImage className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isSubmitting}
                  >
                    Pilih Gambar
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  PNG, JPG, GIF hingga 5MB
                </p>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-gray-800 rounded-md hover:bg-gray-900 flex items-center"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <FaSpinner className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-blue-600 text-white">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center">
            <FaCashRegister className="w-8 h-8" />
            <span className="ml-3 text-xl font-bold">KasirKuy</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.is_admin && (
              <button
                onClick={() => router.push('/admin')}
                className="flex items-center px-3 py-2 text-sm bg-blue-700 rounded-lg hover:bg-blue-800"
              >
                <FaUserCog className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Admin Panel</span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center px-3 py-2 text-sm bg-red-600 rounded-lg hover:bg-red-700"
            >
              <FaSignOutAlt className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Cart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Product List - Takes 2 columns on large screens */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                    <h2 className="text-lg font-bold text-gray-800">Produk</h2>
                    <button
                      onClick={() => {
                        setEditingProduct(null);
                        setShowModal(true);
                      }}
                      className="flex items-center px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 w-full sm:w-auto justify-center"
                    >
                      <FaPlus className="w-4 h-4 mr-2" />
                      Tambah Produk
                    </button>
                  </div>

                  {/* Product Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {products.map((product) => (
                      <div
                        key={product.id}
                        className="bg-white border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-square relative">
                          {product.image_url ? (
                            <img
                              src={`${process.env.NEXT_PUBLIC_API_URL}/api/uploads/${product.image_url}`}
                              alt={product.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = '/placeholder.png';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <img 
                                src="/placeholder.png"
                                alt="placeholder"
                                className="w-8 h-8 text-gray-400"
                              />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-medium text-gray-900 truncate">{product.name}</h3>
                          <p className="text-gray-600 text-sm mt-1">{formatToRupiah(product.price)}</p>
                          <div className="flex justify-between items-center mt-2">
                            <button
                              onClick={() => addToCart(product)}
                              className="flex-1 mr-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              + Keranjang
                            </button>
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  setEditingProduct(product);
                                  setShowModal(true);
                                }}
                                className="p-1.5 text-gray-600 hover:text-blue-600 rounded"
                              >
                                <FaEdit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(product.id)}
                                className="p-1.5 text-red-600 hover:text-red-800 rounded"
                              >
                                <FaTrash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cart - Takes 1 column and sticks to the right on large screens */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-sm sticky top-20">
                  <div className="p-4">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">Keranjang</h2>
                    <div className="space-y-4">
                      {cartItems.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">Keranjang kosong</p>
                      ) : (
                        <>
                          {/* Cart Items */}
                          <div className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto">
                            {cartItems.map((item) => (
                              <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                <div className="w-12 h-12 relative rounded overflow-hidden flex-shrink-0">
                                  {item.image_url ? (
                                    <img
                                      src={`${process.env.NEXT_PUBLIC_API_URL}/api/uploads/${item.image_url}`}
                                      alt={item.name}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.src = '/placeholder.png';
                                      }}
                                    />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                      <img 
                                        src="/placeholder.png"
                                        alt="placeholder"
                                        className="w-5 h-5 text-gray-400"
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-sm font-medium text-gray-900 truncate">{item.name}</h3>
                                  <p className="text-sm text-gray-600">{formatToRupiah(item.price)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                                    className="p-1 text-gray-600 hover:text-red-600"
                                    disabled={item.quantity <= 1}
                                  >
                                    <FaMinus className="w-3 h-3" />
                                  </button>
                                  <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                                  <button
                                    onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                                    className="p-1 text-gray-600 hover:text-green-600"
                                  >
                                    <FaPlus className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(item.id)}
                                    className="p-1 text-red-600 hover:text-red-800"
                                  >
                                    <FaTrash className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Cart Summary */}
                          <div className="border-t pt-4">
                            <div className="flex justify-between items-center mb-4">
                              <span className="text-gray-600">Total:</span>
                              <span className="text-lg font-bold text-gray-900">{formatToRupiah(calculateTotal())}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => setCartItems([])}
                                className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                              >
                                <FaTrash className="w-4 h-4 mr-2" />
                                Kosongkan
                              </button>
                              <button
                                onClick={handlePrint}
                                className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                disabled={cartItems.length === 0}
                              >
                                <FaPrint className="w-4 h-4 mr-2" />
                                Cetak Struk
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Product Modal */}
      <ProductModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingProduct(null);
        }}
        onSubmit={handleSubmitProduct}
        editingProduct={editingProduct}
        isSubmitting={isSubmitting}
      />
    </div>
  );
} 