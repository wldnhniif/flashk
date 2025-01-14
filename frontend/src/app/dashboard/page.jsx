'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSignOutAlt, FaPlus, FaShoppingCart, FaPrint, FaImage, FaEdit, FaTrash, FaBox, FaSpinner, FaTimes } from 'react-icons/fa';
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
  const [cart, setCart] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const { user, logout, api, loading } = useAuth();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [user]);

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

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products');
      setProducts(response.data.products);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal mengambil produk');
    }
  };

  const handleAddProduct = async (formData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/api/products', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setProducts([...products, response.data.product]);
      toast.success('Produk berhasil ditambahkan');
      setShowModal(false);
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Gagal menambahkan produk');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProduct = async (formData) => {
    if (!editingProduct) return;
    
    setIsSubmitting(true);
    try {
      const productId = editingProduct.id;
      
      // Create FormData with all fields
      const data = new FormData();
      const name = formData.get('name') || editingProduct.name;
      const price = formData.get('price') || editingProduct.price;
      
      data.append('name', name.trim());
      data.append('price', price);
      
      // Only append image if a new one is selected
      const image = formData.get('image');
      if (image && image.size > 0) {
        data.append('image', image);
      }

      const response = await api.put(`/api/products/${productId}`, data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.data || !response.data.product) {
        throw new Error('Invalid response from server');
      }

      // Update the products list with the updated product
      setProducts(products.map(p => p.id === productId ? response.data.product : p));
      toast.success('Produk berhasil diperbarui');
      setShowModal(false);
      setEditingProduct(null);
      
      // Refresh the products list
      await fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
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
    setCart(cart.map(item => 
      item.id === productId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      updateCartItemQuantity(product.id, existingItem.quantity + 1);
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success('Produk ditambahkan ke keranjang');
  };

  const handlePrint = async () => {
    if (cart.length === 0) {
      toast.error('Keranjang belanja kosong');
      return;
    }

    try {
      // Calculate total
      const total = calculateTotal();

      // Generate receipt PDF using backend API
      const response = await api.post('/api/generate-receipt', {
        items: cart.map(item => ({
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
      setCart([]);
      toast.success('Transaksi berhasil');

      // Refresh products to update stock
      fetchProducts();
    } catch (error) {
      console.error('Error processing transaction:', error.response || error);
      toast.error(error.response?.data?.message || 'Gagal memproses transaksi. Silakan coba lagi.');
    }
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // Product Card Component
  const ProductCard = ({ product, onEdit, onDelete }) => (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="relative w-full pb-[100%]">
        {product.image_url ? (
          <img
            src={`${process.env.NEXT_PUBLIC_API_URL}${product.image_url}?t=${new Date().getTime()}`}
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
        setPreviewUrl(editingProduct.image_url ? `${process.env.NEXT_PUBLIC_API_URL}${editingProduct.image_url}?t=${new Date().getTime()}` : '');
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
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-gray-700 to-gray-800 p-2 rounded-lg">
                <FaCashRegister className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-800">KasirKuy</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 hidden sm:inline">
                Halo, {user?.username}
              </span>
              {user?.is_admin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Panel Admin
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                <FaSignOutAlt className="w-4 h-4 mr-2" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 pb-32 lg:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products Section */}
          <div className="lg:col-span-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
              <h2 className="text-xl font-semibold text-gray-800">Produk</h2>
              <button
                onClick={() => {
                  setEditingProduct(null);
                  setShowModal(true);
                }}
                className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 w-full sm:w-auto justify-center"
              >
                <FaPlus className="w-4 h-4 mr-2" />
                Tambah Produk
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={(product) => {
                    setEditingProduct(product);
                    setShowModal(true);
                  }}
                  onDelete={handleDeleteProduct}
                />
              ))}
            </div>
          </div>

          {/* Cart Section - Hidden by default on mobile, shown when cart button is clicked */}
          <div className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity lg:relative lg:bg-transparent lg:block ${showCart ? 'opacity-100' : 'opacity-0 pointer-events-none lg:opacity-100 lg:pointer-events-auto'}`}>
            <div className={`fixed bottom-0 left-0 right-0 bg-white transform transition-transform lg:static lg:transform-none ${showCart ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'}`}>
              {/* Cart Header with close button on mobile */}
              <div className="flex justify-between items-center p-4 border-b border-gray-200 lg:border-none sticky top-0 bg-white">
                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-semibold text-gray-800">Keranjang</h2>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-sm">
                    {cart.length} item
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePrint}
                    disabled={cart.length === 0}
                    className="flex items-center px-3 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    <FaPrint className="w-4 h-4 mr-2" />
                    Cetak Struk
                  </button>
                  <button
                    onClick={() => setShowCart(false)}
                    className="lg:hidden text-gray-500 hover:text-gray-700"
                  >
                    <FaTimes className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              <div className="p-4 max-h-[60vh] lg:max-h-[calc(100vh-24rem)] overflow-y-auto">
                {cart.length > 0 ? (
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-800 truncate">{item.name}</h3>
                          <p className="text-sm text-gray-600">{formatToRupiah(item.price)} × {item.quantity}</p>
                        </div>
                        <div className="flex items-center space-x-3 ml-4">
                          <button
                            onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)}
                            className="p-1 text-gray-600 hover:text-gray-800 text-lg"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)}
                            className="p-1 text-gray-600 hover:text-gray-800 text-lg"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-6">
                    Keranjang kosong
                  </div>
                )}
              </div>

              {/* Cart Total */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0">
                  <div className="flex justify-between items-center text-lg font-semibold text-gray-800">
                    <span>Total</span>
                    <span>{formatToRupiah(calculateTotal())}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Cart Button - Only visible on mobile when cart is hidden */}
          <button
            onClick={() => setShowCart(true)}
            className={`fixed bottom-4 right-4 z-20 lg:hidden bg-gray-800 text-white p-4 rounded-full shadow-lg ${showCart ? 'hidden' : ''}`}
          >
            <div className="relative">
              <FaShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
          </button>
        </div>
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