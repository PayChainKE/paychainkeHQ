import React from 'react';
import { ShoppingCart } from 'lucide-react';

interface StoreHeaderProps {
  cartCount: number;
}

const StoreHeader: React.FC<StoreHeaderProps> = ({ cartCount }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-md border-b border-emerald-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-emerald-400">PayChain</h1>
            <span className="ml-2 text-sm text-gray-400">KE</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <ShoppingCart className="h-6 w-6 text-white hover:text-emerald-400 transition-colors cursor-pointer" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default StoreHeader;