import React from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    categories: string[];
    priceRange: [number, number];
    sortBy: string;
  };
  onFiltersChange: (filters: any) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  searchQuery,
  onSearchChange,
}) => {
  const categories = [
    'T-Shirts',
    'Hoodies',
    'Caps',
    'Tote Bags',
    'Socks',
    'Stickers',
    'Accessories',
  ];

  const sortOptions = [
    { value: 'name', label: 'Name A-Z' },
    { value: 'price-low', label: 'Price: Low to High' },
    { value: 'price-high', label: 'Price: High to Low' },
    { value: 'newest', label: 'Newest First' },
  ];

  const handleCategoryChange = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  const handlePriceChange = (min: number, max: number) => {
    onFiltersChange({ ...filters, priceRange: [min, max] });
  };

  const handleSortChange = (sortBy: string) => {
    onFiltersChange({ ...filters, sortBy });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-80 bg-white shadow-lg h-fit sticky top-4">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Desktop Filters */}
        <div className="p-4 space-y-6">
          {/* Sort By */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Sort By</h3>
            <div className="space-y-2">
              {sortOptions.map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="sort"
                    value={option.value}
                    checked={filters.sortBy === option.value}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <label key={category} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={() => handleCategoryChange(category)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{category}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Price Range</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.priceRange[0]}
                  onChange={(e) => handlePriceChange(Number(e.target.value), filters.priceRange[1])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.priceRange[1]}
                  onChange={(e) => handlePriceChange(filters.priceRange[0], Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={() => onFiltersChange({
              categories: [],
              priceRange: [0, 10000],
              sortBy: 'name'
            })}
            className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors text-sm font-medium"
          >
            Clear All Filters
          </button>
        </div>
      </div>

      {/* Mobile Filter Modal (Alibaba Style) */}
      <div className={`fixed inset-x-0 bottom-0 z-50 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out lg:hidden ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="flex flex-col max-h-[85vh]">
          {/* Drag Handle */}
          <div className="flex justify-center py-3">
            <div className="w-10 h-1 bg-gray-300 rounded-full"></div>
          </div>

          {/* Mobile Header */}
          <div className="flex items-center justify-between px-6 pb-4">
            <h2 className="text-xl font-semibold text-gray-900">Filter & Sort</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Mobile Filters */}
          <div className="flex-1 overflow-y-auto">
            {/* Sort By Section */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sort By</h3>
              <div className="grid grid-cols-2 gap-3">
                {sortOptions.map((option) => (
                  <label key={option.value} className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    filters.sortBy === option.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="sort"
                      value={option.value}
                      checked={filters.sortBy === option.value}
                      onChange={(e) => handleSortChange(e.target.value)}
                      className="w-5 h-5 text-green-600 focus:ring-green-500"
                    />
                    <span className={`ml-3 font-medium ${
                      filters.sortBy === option.value ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Categories Section */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((category) => (
                  <label key={category} className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all ${
                    filters.categories.includes(category)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                    <input
                      type="checkbox"
                      checked={filters.categories.includes(category)}
                      onChange={() => handleCategoryChange(category)}
                      className="w-5 h-5 text-green-600 focus:ring-green-500 rounded"
                    />
                    <span className={`ml-3 font-medium ${
                      filters.categories.includes(category) ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {category}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range Section */}
            <div className="px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Price Range</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Price (KES)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={filters.priceRange[0]}
                      onChange={(e) => handlePriceChange(Number(e.target.value), filters.priceRange[1])}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Price (KES)</label>
                    <input
                      type="number"
                      placeholder="10000"
                      value={filters.priceRange[1]}
                      onChange={(e) => handlePriceChange(filters.priceRange[0], Number(e.target.value))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Action Buttons */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-3">
              <button
                onClick={() => onFiltersChange({
                  categories: [],
                  priceRange: [0, 10000],
                  sortBy: 'name'
                })}
                className="flex-1 px-6 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-base"
              >
                Reset
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-6 py-4 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors text-base"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FilterSidebar;