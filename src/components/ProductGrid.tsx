import React from 'react';
import ProductCard from './ProductCard';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
}

interface ProductGridProps {
  products: Product[];
  addToCart: (product: Product) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, addToCart }) => {
  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-7xl mx-auto">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} addToCart={addToCart} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProductGrid;