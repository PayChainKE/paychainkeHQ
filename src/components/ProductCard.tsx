import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

interface ProductCardProps {
  product: Product;
  addToCart: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, addToCart }) => {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    navigate(`/product/${product.id}`);
  };
  return (
    <motion.div
      whileHover={{ y: -5, boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="bg-white rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 h-full flex flex-col"
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-xl font-bold text-gray-900">KES {product.price}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleViewDetails}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md transition-colors text-sm font-medium border border-gray-300"
            >
              View Details
            </button>
            <button
              onClick={() => addToCart(product)}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-md transition-colors text-sm font-medium"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;