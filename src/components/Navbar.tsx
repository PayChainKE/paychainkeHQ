import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, FileCode, GitBranch, Menu, X, ChevronRight, Copyright, ChevronDown, PlayCircle, ShoppingBag, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavbarProps {
  cartCount?: number;
}

const Navbar: React.FC<NavbarProps> = ({ cartCount = 0 }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const [isResourcesDropdownOpen, setIsResourcesDropdownOpen] = useState(false);
  const [isMobileResourcesDropdownOpen, setIsMobileResourcesDropdownOpen] = useState(false);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // Close avatar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isAvatarDropdownOpen && !(event.target as Element).closest('.avatar-dropdown')) {
        setIsAvatarDropdownOpen(false);
      }
      if (isResourcesDropdownOpen && !(event.target as Element).closest('.resources-dropdown')) {
        setIsResourcesDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAvatarDropdownOpen, isResourcesDropdownOpen]);

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/how-it-works', label: 'How It Works', icon: PlayCircle },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/store', label: 'Merchandise', icon: ShoppingBag },
    { 
      path: '/docs', 
      label: 'Resources', 
      icon: FileCode,
      hasDropdown: true,
      dropdownItems: [
        { path: '/about', label: 'About Us', description: 'Our mission and team', emoji: 'ℹ️' },
        { path: '/pricing', label: 'Pricing', description: 'Simple, transparent fees', emoji: '💰' },
        { path: '/docs', label: 'Docs', description: 'API documentation and guides', emoji: '📚' },
        { path: '/coverage', label: 'Coverage', description: 'Available countries', emoji: '🗺️' },
        { path: '/blog', label: 'Blog', description: 'Latest articles & updates', emoji: '📰' },
        { path: '/contact', label: 'Contact Support', description: '', emoji: '' },
      ]
    },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-white">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Mobile Menu Button */}
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                className="md:hidden p-2 text-black font-bold transition-colors duration-200"
                onClick={() => {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                  if (isMobileMenuOpen) {
                    setIsMobileResourcesDropdownOpen(false);
                  }
                }}
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6 font-bold" /> : <Menu className="w-6 h-6 font-bold" />}
              </button>

              {/* Logo */}
              <Link to="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/logo.png" alt="PayChain KE Logo" className="h-6 md:h-8 w-auto border border-green-500" />
              </Link>
            </div>

            {/* Desktop Nav Links and User Auth */}
            <div className="hidden md:flex items-center gap-6 lg:gap-8">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                if (item.hasDropdown) {
                  return (
                    <div key={item.path} className="relative resources-dropdown">
                      <button
                        onClick={() => setIsResourcesDropdownOpen(!isResourcesDropdownOpen)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200",
                          "text-gray-700 hover:text-gray-900"
                        )}
                      >
                        {item.label}
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          isResourcesDropdownOpen ? "rotate-180" : ""
                        )} />
                      </button>
                      
                      {isResourcesDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                          {item.dropdownItems?.map((dropdownItem, index) => (
                            <Link
                              key={dropdownItem.path}
                              to={dropdownItem.path}
                              className={cn(
                                "flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors",
                                index === 0 && "rounded-t-lg",
                                index === (item.dropdownItems?.length || 0) - 1 && "rounded-b-lg",
                                dropdownItem.label === 'Contact Support' && "bg-gray-100 hover:bg-gray-200 font-medium"
                              )}
                              onClick={() => setIsResourcesDropdownOpen(false)}
                            >
                              <span className="text-lg flex-shrink-0 mt-0.5">{dropdownItem.emoji}</span>
                              <div>
                                <div className="font-medium text-gray-900">{dropdownItem.label}</div>
                                {dropdownItem.description && (
                                  <div className="text-sm text-gray-600">{dropdownItem.description}</div>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "text-primary"
                        : "text-gray-700 hover:text-gray-900"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
              
              {/* Cart or User Avatar Dropdown */}
              {location.pathname === '/store' || location.pathname.startsWith('/product') ? (
                <div className="relative ml-4 pl-4 border-l border-gray-200">
                  <Link to="/checkout" className="flex items-center gap-2 px-2 py-1 transition-colors duration-200">
                    <div className="relative">
                      <ShoppingCart className="w-6 h-6 text-gray-700 hover:text-gray-900" />
                      {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {cartCount}
                        </span>
                      )}
                    </div>
                  </Link>
                </div>
              ) : (
                <div className="relative ml-4 pl-4 border-l border-gray-200 avatar-dropdown">
                  <button
                    onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                    className="flex items-center gap-2 px-2 py-1 transition-colors duration-200"
                    aria-label="User menu"
                  >
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                      <img src="/avator.png" alt="User Avatar" className="w-full h-full object-cover" />
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  </button>
                  
                  {/* Dropdown Menu */}
                  {isAvatarDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-4 z-50">
                      <div className="px-4 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                            <img src="/avator.png" alt="User Avatar" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">User</div>
                            <div className="text-sm text-gray-500">Log in to access your account</div>
                          </div>
                        </div>
                      </div>
                      <div className="pt-3 space-y-2 px-2">
                        <button
                          onClick={() => setIsAvatarDropdownOpen(false)}
                          className="w-full px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200 rounded-md border border-gray-200"
                        >
                          Sign In
                        </button>
                        <button
                          onClick={() => setIsAvatarDropdownOpen(false)}
                          className="w-full px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200 rounded-md border border-gray-200"
                        >
                          Sign Up
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile User Avatar or Cart */}
            {location.pathname === '/store' || location.pathname.startsWith('/product') ? (
              <div className="md:hidden relative">
                <Link to="/checkout" className="flex items-center gap-2 px-2 py-1 transition-colors duration-200">
                  <div className="relative">
                    <ShoppingCart className="w-6 h-6 text-gray-700" />
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                        {cartCount}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ) : (
              <div className="md:hidden relative avatar-dropdown">
                <button
                  onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                  className="flex items-center gap-2 px-2 py-1 transition-colors duration-200"
                  aria-label="User menu"
                >
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                    <img src="/avator.png" alt="User Avatar" className="w-full h-full object-cover" />
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                </button>
                
                {/* Mobile Dropdown Menu */}
                {isAvatarDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-4 z-50">
                    <div className="px-4 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                          <img src="/avator.png" alt="User Avatar" className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">User</div>
                          <div className="text-sm text-gray-500">Log in to access your account</div>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 space-y-2 px-2">
                      <button
                        onClick={() => setIsAvatarDropdownOpen(false)}
                        className="w-full px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200 rounded-md border border-gray-200"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => setIsAvatarDropdownOpen(false)}
                        className="w-full px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200 rounded-md border border-gray-200"
                      >
                        Sign Up
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-all duration-300 ease-in-out",
          isMobileMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
        onClick={() => {
          setIsMobileMenuOpen(false);
          setIsMobileResourcesDropdownOpen(false);
        }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Slide-out Menu */}
        <div
          className={cn(
            "absolute top-0 left-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-[60]",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6">
            <div className={cn(
              "flex items-center gap-3 transition-all duration-300",
              isMobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            )}>
            </div>
            <button
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-6 py-8 pb-20">
            <div className="space-y-2">
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                if (item.hasDropdown) {
                  return (
                    <div key={item.path} className="space-y-1">
                      <button
                        onClick={() => setIsMobileResourcesDropdownOpen(!isMobileResourcesDropdownOpen)}
                        className={cn(
                          "flex items-center justify-between w-full py-3 transition-all duration-200 group",
                          "text-gray-700 hover:text-gray-900"
                        )}
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animation: isMobileMenuOpen ? 'slideInFromRight 0.3s ease-out forwards' : 'none'
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="w-5 h-5 text-gray-500" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <ChevronDown className={cn(
                          "w-4 h-4 transition-transform duration-200",
                          isMobileResourcesDropdownOpen ? "rotate-180" : ""
                        )} />
                      </button>
                      
                      {isMobileResourcesDropdownOpen && (
                        <div className="ml-8 space-y-1 border-l-2 border-gray-200 pl-4">
                          {item.dropdownItems?.map((dropdownItem, dropdownIndex) => (
                            <Link
                              key={dropdownItem.path}
                              to={dropdownItem.path}
                              className={cn(
                                "flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200 text-sm",
                                "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                                dropdownItem.label === 'Contact Support' && "bg-gray-100 hover:bg-gray-200 font-medium"
                              )}
                              onClick={() => {
                                setIsMobileMenuOpen(false);
                                setIsMobileResourcesDropdownOpen(false);
                              }}
                              style={{
                                animationDelay: `${(index * 50) + (dropdownIndex * 30) + 200}ms`,
                                animation: isMobileMenuOpen ? 'slideInFromRight 0.3s ease-out forwards' : 'none'
                              }}
                            >
                              <span className="text-base">{dropdownItem.emoji}</span>
                              <span>{dropdownItem.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center justify-between w-full py-3 transition-all duration-200 group",
                      isActive
                        ? "text-primary"
                        : "text-gray-700 hover:text-gray-900"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: isMobileMenuOpen ? 'slideInFromRight 0.3s ease-out forwards' : 'none'
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-gray-500" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 transition-transform duration-200",
                        isActive ? "text-primary" : "text-gray-400 group-hover:translate-x-1"
                      )} />
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 bg-gray-900 text-white p-4 border-t border-gray-700">
              <div className="flex items-center justify-center gap-2 text-xs">
                <Copyright className="w-3 h-3" />
                <span>2026 PaychainKE | Powered by Base L2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
