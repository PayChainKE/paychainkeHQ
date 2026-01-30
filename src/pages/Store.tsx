import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import StoreHero from '../components/StoreHero';
import ProductGrid from '../components/ProductGrid';
import Footer from '../components/Footer';
import FilterSidebar from '../components/FilterSidebar';
import { SlidersHorizontal, ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

const Store: React.FC = () => {
  const { addToCart, getCartItemCount } = useCart();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    categories: [] as string[],
    priceRange: [0, 10000] as [number, number],
    sortBy: 'name' as string,
  });

  // Sample products data (in a real app, this would come from an API)
  const allProducts: Product[] = [
    {
      id: 1,
      name: 'PayChain Tech T-Shirt',
      description: 'Minimal blockchain pattern with PayChainKE logo. Premium cotton, perfect for developers.',
      price: 2500,
      image: '/logo 1.png',
    },
    {
      id: 2,
      name: 'Validator Hoodie',
      description: 'Comfortable sweatshirt with "Secure. Verify. Trust." slogan. Ideal for cold Nairobi nights.',
      price: 4500,
      image: '/logo 1.png',
    },
    {
      id: 3,
      name: 'Truth Layer Cap',
      description: 'Adjustable snapback with embroidered PayChain logo. UV protection for outdoor coding sessions.',
      price: 1800,
      image: '/logo 1.png',
    },
    {
      id: 4,
      name: 'Blockchain Tote Bag',
      description: 'Eco-friendly canvas tote with minimal crypto design. Perfect for carrying your laptop to meetups.',
      price: 1200,
      image: '/logo 1.png',
    },
    {
      id: 5,
      name: 'Consensus Socks',
      description: 'Comfy cotton socks with blockchain node pattern. Because great developers need great foundations.',
      price: 800,
      image: '/logo 1.png',
    },
    {
      id: 6,
      name: 'PayChain Stickers Pack',
      description: '10 premium vinyl stickers with various PayChain designs. Decorate your laptop, water bottle, or anywhere!',
      price: 500,
      image: '/logo 1.png',
    },
    {
      id: 7,
      name: 'Insulated Water Bottle',
      description: 'Double-wall stainless steel bottle keeps drinks cold for 24hrs. Perfect for long coding sessions.',
      price: 2200,
      image: '/logo 1.png',
    },
    {
      id: 8,
      name: 'Crypto Tumbler',
      description: 'Travel mug with blockchain-inspired design. Keeps coffee hot and your crypto knowledge fresh.',
      price: 1600,
      image: '/logo 1.png',
    },
    {
      id: 9,
      name: 'Smart Notebook',
      description: 'Digital notebook that scans and digitizes your notes. Perfect for brainstorming blockchain ideas.',
      price: 3500,
      image: '/logo 1.png',
    },
    {
      id: 10,
    name: 'RFID Card Holder',
    description: 'Slim wallet with RFID blocking technology. Protects your crypto cards from digital pickpocketing.',
    price: 1400,
    image: '/logo 1.png',
  },
  {
    id: 11,
    name: 'Full Zip Puff Jacket',
    description: 'Insulated puff jacket with full zipper. Perfect for Nairobi\'s variable weather and late-night coding sessions.',
    price: 5200,
    image: '/logo 1.png',
  },
  {
    id: 12,
    name: 'Half Zip Puff Jacket',
    description: 'Stylish half-zip puff jacket with blockchain-inspired design. Layer perfectly over your PayChain t-shirt.',
    price: 4800,
    image: '/logo 1.png',
  },
];

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = allProducts.filter(product => {
      // Search filter
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Price filter
      const matchesPrice = product.price >= filters.priceRange[0] && product.price <= filters.priceRange[1];

      // Category filter (simplified - in real app, products would have category field)
      const matchesCategory = filters.categories.length === 0 || filters.categories.some(cat =>
        product.name.toLowerCase().includes(cat.toLowerCase().replace(' ', '')) ||
        product.description.toLowerCase().includes(cat.toLowerCase().replace(' ', ''))
      );

      return matchesSearch && matchesPrice && matchesCategory;
    });

    // Sort products
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'newest':
          return b.id - a.id; // Assuming higher ID = newer
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [allProducts, searchQuery, filters]);

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000) count++;
    if (filters.sortBy !== 'name') count++;
    if (searchQuery.trim()) count++;
    return count;
  }, [filters, searchQuery]);

  const clearAllFilters = () => {
    setFilters({
      categories: [],
      priceRange: [0, 10000],
      sortBy: 'name',
    });
    setSearchQuery('');
  };

  // Active filter categories for display
  const activeFilterCategories = useMemo(() => {
    const categories = [];
    if (filters.categories.length > 0) categories.push('Category');
    if (filters.priceRange[0] > 0 || filters.priceRange[1] < 10000) categories.push('Price');
    if (filters.sortBy !== 'name') categories.push('Sort');
    return categories;
  }, [filters]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar cartCount={getCartItemCount()} />

      {/* Mobile Filter Bar (Alibaba Style) */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filter Options Bar */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 overflow-x-auto">
            {/* Sort Filter */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                filters.sortBy !== 'name'
                  ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              <span>Sort</span>
              {filters.sortBy !== 'name' && (
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              )}
            </button>

            {/* Category Filter */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                filters.categories.length > 0
                  ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>Category</span>
              {filters.categories.length > 0 && (
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              )}
            </button>

            {/* Price Filter */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                filters.priceRange[0] > 0 || filters.priceRange[1] < 10000
                  ? 'bg-green-50 border-green-300 text-green-700 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
              <span>Price</span>
              {filters.priceRange[0] > 0 || filters.priceRange[1] < 10000 && (
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              )}
            </button>

            {/* Results Count */}
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 ml-auto">
              <span className="font-medium">{filteredProducts.length}</span>
              <span>products</span>
            </div>
          </div>

          {/* Active Filter Tags */}
          {activeFilterCategories.length > 0 && (
            <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
              <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Active filters:</span>
              {activeFilterCategories.map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full whitespace-nowrap border border-green-200"
                >
                  {category}
                  <button
                    onClick={() => {
                      if (category === 'Category') {
                        setFilters({...filters, categories: []});
                      } else if (category === 'Price') {
                        setFilters({...filters, priceRange: [0, 10000]});
                      } else if (category === 'Sort') {
                        setFilters({...filters, sortBy: 'name'});
                      }
                    }}
                    className="hover:bg-green-200 rounded-full p-0.5 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              {activeFilterCategories.length > 1 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-green-600 hover:text-green-700 font-semibold whitespace-nowrap ml-2 underline"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex">
        {/* Filter Sidebar */}
        <FilterSidebar
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          filters={filters}
          onFiltersChange={setFilters}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Main Content */}
        <div className="flex-1">
          <StoreHero />

          {/* Results Summary */}
          <div className="px-4 sm:px-6 lg:px-8 py-3 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">{filteredProducts.length}</span> of {allProducts.length} products
              </p>
            </div>
          </div>

          <ProductGrid products={filteredProducts} addToCart={addToCart} />
        </div>
      </div>

      <Footer />

      {/* Floating Cart Button */}
      {getCartItemCount() > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <Link
            to="/checkout"
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 transition-colors"
          >
            <ShoppingCart className="w-5 h-5" />
            <span className="font-medium">Checkout ({getCartItemCount()})</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default Store;