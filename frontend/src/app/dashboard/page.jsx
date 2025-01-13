'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { FaCashRegister, FaSignOutAlt, FaPlus, FaShoppingCart, FaPrint, FaImage, FaEdit, FaTrash } from 'react-icons/fa';
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
      toast.error('Failed to fetch products');
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

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', newProduct.name);
      formData.append('price', String(newProduct.price));
      if (newProduct.image) {
        formData.append('image', newProduct.image);
      }

      const response = await api.post('/api/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const newProductData = {
        ...response.data.product,
        image_url: response.data.product.image_url ? 
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${response.data.product.image_url}` : null
      };
      
      setProducts([...products, newProductData]);
      setNewProduct({ name: '', price: '', image: null });
      setImagePreview(null);
      toast.success('Product added successfully');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error(error.response?.data?.error || 'Failed to add product');
    }
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    toast.success('Added to cart');
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) return;
    setCart(cart.map(item =>
      item.id === productId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const printReceipt = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      // Show loading toast
      const loadingToast = toast.loading('Generating receipt...');

      // Format cart items to send only numerical values for prices
      const items = cart.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.price) // Ensure price is a number
      }));

      const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const response = await api.post('/api/generate-receipt', {
        items,
        total
      });

      if (response.data.pdf_url) {
        // Dismiss loading toast
        toast.dismiss(loadingToast);

        // Get the full URL
        const pdfUrl = response.data.pdf_url.startsWith('http') 
          ? response.data.pdf_url 
          : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${response.data.pdf_url}`;

        // Open PDF in new tab
        window.open(pdfUrl, '_blank');

        // Clear cart after successful receipt generation
        setCart([]);
        toast.success('Receipt generated successfully');
      }
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error(error.response?.data?.error || 'Failed to generate receipt');
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', editingProduct.name);
      formData.append('price', String(editingProduct.price));
      if (editingProduct.newImage) {
        formData.append('image', editingProduct.newImage);
      }

      const response = await api.put(`/api/products/${editingProduct.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const updatedProductData = {
        ...response.data.product,
        image_url: response.data.product.image_url ? 
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${response.data.product.image_url}` : null
      };
      
      setProducts(products.map(p => p.id === updatedProductData.id ? updatedProductData : p));
      setEditingProduct(null);
      setImagePreview(null);
      toast.success('Product updated successfully');
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error(error.response?.data?.error || 'Failed to update product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      console.log('Deleting product:', productId);
      const response = await api.delete(`/api/products/${productId}`);
      if (response.data.message) {
        setProducts(products.filter(p => p.id !== productId));
        toast.success('Product deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(error.response?.data?.error || 'Failed to delete product');
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
                  Admin Panel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                <FaSignOutAlt className="w-4 h-4 mr-2" />
                Logout
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
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <form onSubmit={editingProduct ? handleUpdateProduct : handleAddProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Product Name</label>
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
                  <label className="block text-sm font-medium text-gray-600 mb-1">Price</label>
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
                  <label className="block text-sm font-medium text-gray-600 mb-1">Product Image</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center px-4 py-2 border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                      <FaImage className="w-5 h-5 text-gray-500 mr-2" />
                      <span className="text-sm text-gray-600">Choose Image</span>
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
                    {editingProduct ? 'Update Product' : 'Add Product'}
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
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Products Grid */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {products.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="w-full h-48 relative">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Image load error:', product.image_url);
                          if (!e.target.dataset.fallbackAttempted) {
                            e.target.dataset.fallbackAttempted = true;
                            e.target.src = '/no-image.svg';
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <div className="text-center">
                          <FaImage className="w-12 h-12 text-gray-400 mx-auto" />
                          <p className="mt-2 text-sm text-gray-500">No image available</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-medium text-gray-800">{product.name}</h3>
                    <p className="text-gray-600">{formatToRupiah(product.price)}</p>
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={() => addToCart(product)}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900"
                      >
                        <FaShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </button>
                      <button
                        onClick={() => handleEditClick(product)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md"
                      >
                        <FaEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="px-4 py-2 text-red-600 hover:text-red-800 border border-gray-300 rounded-md"
                      >
                        <FaTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shopping Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Shopping Cart</h2>
                <FaShoppingCart className="w-6 h-6 text-gray-600" />
              </div>
              
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Your cart is empty</p>
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
                      Print Receipt
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