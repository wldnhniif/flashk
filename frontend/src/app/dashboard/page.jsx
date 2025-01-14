'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSignOutAlt, FaPlus, FaShoppingCart, FaPrint, FaImage, FaEdit, FaTrash, FaBox, FaSpinner } from 'react-icons/fa';
import axios from 'axios';

const formatToRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(number);
};

// Product Card
const ProductCard = ({ product, onEdit, onDelete }) => (
  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
    <div className="relative w-full pb-[100%]"> {/* 1:1 aspect ratio */}
      {product.image_url ? (
        <img
          src={`${process.env.NEXT_PUBLIC_API_URL}${product.image_url}`}
          alt={product.name}
          className="absolute top-0 left-0 w-full h-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/placeholder.png';
          }}
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
      <div className="flex justify-end space-x-2">
        <button
          onClick={() => onEdit(product)}
          className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <FaEdit className="w-5 h-5" />
        </button>
        <button
          onClick={() => onDelete(product.id)}
          className="p-2 text-red-600 hover:text-red-800 transition-colors"
        >
          <FaTrash className="w-5 h-5" />
        </button>
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
      setPreviewUrl(editingProduct.image_url ? `${process.env.NEXT_PUBLIC_API_URL}${editingProduct.image_url}` : '');
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
      onClose();
    } catch (error) {
      console.error('Error submitting product:', error);
      // Error handling is done in the parent component
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
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

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: null });
  const [editingProduct, setEditingProduct] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const { user, logout, api } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    fetchProducts();
  }, [user, router]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/api/products');
      const productsWithFormattedUrls = response.data.products.map(product => ({
        ...product,
        image_url: product.image_url ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${product.image_url}` : null
      }));
      setProducts(productsWithFormattedUrls);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Gagal mengambil produk');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProduct({ ...newProduct, image: file });
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      return () => URL.revokeObjectURL(previewUrl);
    }
  };

  const handleAddProduct = async (formData) => {
    setIsSubmitting(true);
    try {
      const response = await api.post('/api/products', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // Increase timeout for image upload
      });
      
      setProducts([...products, response.data.product]);
      toast.success('Produk berhasil ditambahkan');
      setShowModal(false);
    } catch (error) {
      console.error('Error adding product:', error);
      if (error.code === 'ERR_NETWORK') {
        toast.error('Gagal mengunggah produk. Periksa koneksi internet Anda.');
      } else if (error.response?.status === 413) {
        toast.error('Ukuran gambar terlalu besar. Maksimal 5MB.');
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Gagal menambahkan produk. Silakan coba lagi.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProduct = async (formData) => {
    if (!editingProduct) return;
    
    setIsSubmitting(true);
    try {
      const response = await api.put(`/api/products/${editingProduct.id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // Increase timeout for image upload
      });
      
      setProducts(products.map(p => p.id === editingProduct.id ? response.data.product : p));
      toast.success('Produk berhasil diperbarui');
      setShowModal(false);
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      if (error.code === 'ERR_NETWORK') {
        toast.error('Gagal memperbarui produk. Periksa koneksi internet Anda.');
      } else if (error.response?.status === 413) {
        toast.error('Ukuran gambar terlalu besar. Maksimal 5MB.');
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Gagal memperbarui produk. Silakan coba lagi.');
      }
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
      if (error.code === 'ERR_NETWORK') {
        toast.error('Gagal menghapus produk. Periksa koneksi internet Anda.');
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Gagal menghapus produk. Silakan coba lagi.');
      }
    }
  };

  const handleEditClick = (product) => {
    setEditingProduct({
      ...product,
      newImage: null
    });
    setImagePreview(product.image_url);
  };

  const handleEditImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEditingProduct({ ...editingProduct, newImage: file });
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      return () => URL.revokeObjectURL(previewUrl);
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
              <h1 className="text-2xl font-bold text-gray-800">KasirKuy</h1>
            </div>
            <div className="flex items-center space-x-4">
              {user?.is_admin && (
                <button
                  onClick={() => router.push('/admin')}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Panel Admin
                </button>
              )}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Management Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Nama Produk</label>
                  <input
                    type="text"
                    value={editingProduct ? editingProduct.name : newProduct.name}
                    onChange={(e) => editingProduct 
                      ? setEditingProduct({ ...editingProduct, name: e.target.value })
                      : setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 text-gray-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Harga</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct ? editingProduct.price : newProduct.price}
                    onChange={(e) => editingProduct
                      ? setEditingProduct({ ...editingProduct, price: e.target.value })
                      : setNewProduct({ ...newProduct, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-400 focus:border-gray-400 text-gray-700"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Gambar Produk</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                      <FaImage className="w-5 h-5 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-600">Pilih Gambar</span>
                      <input
                        type="file"
                        onChange={editingProduct ? handleEditImageChange : handleImageChange}
                        className="hidden"
                        accept="image/*"
                      />
                    </label>
                    {imagePreview && (
                      <img src={imagePreview} alt="Preview" className="h-12 w-12 object-cover rounded-md border border-gray-300" />
                    )}
                  </div>
                </div>
                <div className="flex space-x-4">
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    <FaPlus className="w-4 h-4 mr-2" />
                    {editingProduct ? 'Perbarui Produk' : 'Tambah Produk'}
                  </button>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProduct(null);
                        setImagePreview(null);
                        setNewProduct({ name: '', price: '', image: null });
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
                    >
                      Batal
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Products Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} onEdit={handleEditClick} onDelete={handleDeleteProduct} />
              ))}
            </div>
          </div>

          {/* Shopping Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Keranjang Belanja</h2>
                <FaShoppingCart className="w-6 h-6 text-gray-600" />
              </div>
              
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Keranjang belanja kosong</p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b">
                      <div>
                        <h3 className="font-medium text-gray-800">{item.name}</h3>
                        <p className="text-sm text-gray-600">{formatToRupiah(item.price)}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-1 text-gray-600 hover:text-gray-800"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-gray-700">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-1 text-gray-600 hover:text-gray-800"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-semibold text-gray-800">Total:</span>
                      <span className="text-xl font-bold text-gray-800">
                        {formatToRupiah(calculateTotal())}
                      </span>
                    </div>
                    
                    <button
                      onClick={printReceipt}
                      className="w-full flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                    >
                      <FaPrint className="w-4 h-4 mr-2" />
                      Cetak Struk
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 