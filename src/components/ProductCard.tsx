import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { Product } from '../context/CartContext';

interface ProductCardProps {
  product: Product;
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    navigate(`/product/${product.id}`);
  };
  return (
    <motion.div
      whileHover={{ y: -5, boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 h-full flex flex-col cursor-pointer"
      onClick={handleViewDetails}
    >
      <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
        <img
          src="/logo 1.png"
          alt="PayChain Logo"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight">{product.name}</h3>
        <p className="text-gray-600 text-sm mb-3 line-clamp-2 flex-1">{product.description}</p>
        <div className="mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-gray-900">KES {product.price}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewDetails();
              }}
              className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-1"
            >
              <Eye className="w-4 h-4" />
              View Details
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;