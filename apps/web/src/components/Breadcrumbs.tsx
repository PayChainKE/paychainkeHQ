import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  currentPage: string;
}

const Breadcrumbs: React.FC<BreadcrumbProps> = ({ currentPage }) => {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-8" aria-label="Breadcrumb">
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-primary transition-colors"
      >
        <Home size={14} />
        <span>Home</span>
      </Link>
      
      <ChevronRight size={14} className="text-gray-300" />
      
      <Link 
        to="/products" 
        className="hover:text-primary transition-colors"
      >
        Product
      </Link>
      
      <ChevronRight size={14} className="text-gray-300" />
      
      <span className="font-medium text-gray-900">{currentPage}</span>
    </nav>
  );
};

export default Breadcrumbs;
