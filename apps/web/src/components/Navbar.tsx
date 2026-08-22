import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, Menu, X, ChevronRight, Copyright, ChevronDown, ShoppingCart, HelpCircle, Mail, BookOpen, Code2 } from 'lucide-react';
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasMobileMenuOpenRef = useRef(false);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsMobileResourcesDropdownOpen(false);
  };

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

  // Focus trap + Escape-to-close + return focus to the hamburger button on
  // close — a slide-out drawer is a modal surface, so it needs the same
  // keyboard behavior any dialog does, not just a click-outside handler.
  useEffect(() => {
    if (isMobileMenuOpen) {
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      focusable?.[0]?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          closeMobileMenu();
          return;
        }
        if (e.key !== 'Tab' || !focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      wasMobileMenuOpenRef.current = true;
      return () => document.removeEventListener('keydown', handleKeyDown);
    } else if (wasMobileMenuOpenRef.current) {
      wasMobileMenuOpenRef.current = false;
      menuButtonRef.current?.focus();
    }
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
    { path: '/about', label: 'Who We Are', icon: Users },
    {
      path: '/products',
      label: 'Products',
      icon: ShoppingCart,
      hasDropdown: true,
        dropdownItems: [
        { path: '/products/virtual-account', label: 'PayChain Virtual Account', description: 'Paybill, payment links, STK push, and invoicing, all verified instantly' },
        { path: '/products/inflation-shield', label: 'The Inflation Shield', description: 'Stablecoin protection (in development)', soon: true },
        { path: '/products/bulk-pay', label: 'Paychain Bulk Pay', description: 'Payroll, suppliers, and utility bills in one click' },
        { path: '/products/cash-advance', label: 'Cash Advance', description: 'Working capital and short-term advances' },
        { path: '/products/operations-tools', label: 'Operations tools', description: 'Reconciliation, disputes, and dashboards' },
      ],
    },
    // Removed Dashboard from nav bar
    { path: '/faq', label: 'FAQs', icon: HelpCircle },
    { path: '/blog', label: 'Blog', icon: BookOpen },
    { path: '/contact', label: 'Contact Us', icon: Mail },
    // Resources removed from nav bar
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white transition-colors duration-300">
        <div className="container mx-auto px-[0.4cm] md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Mobile Menu Button */}
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                ref={menuButtonRef}
                className="md:hidden p-2 text-black font-bold transition-colors duration-200"
                onClick={() => (isMobileMenuOpen ? closeMobileMenu() : setIsMobileMenuOpen(true))}
                aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMobileMenuOpen}
                aria-controls="mobile-nav-drawer"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6 font-bold" /> : <Menu className="w-6 h-6 font-bold" />}
              </button>

              {/* Logo */}
              <Link to="/" className="flex items-center gap-3" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/Home page/paychain official logo.png" alt="PayChain KE Logo" className="h-6 md:h-8 w-auto mix-blend-multiply" />
              </Link>
            </div>

            {/* Desktop Nav Links and User Auth */}
            <div className="hidden md:flex items-center gap-6 lg:gap-8 lg:translate-x-24">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                if (item.hasDropdown) {
                  return (
                    <div key={item.path} className="relative resources-dropdown">
                      <button
                        onClick={() => setIsResourcesDropdownOpen(!isResourcesDropdownOpen)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 text-sm font-bold transition-all duration-200",
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
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900">{dropdownItem.label}</span>
                                  {dropdownItem.soon && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-[#00bf63] border border-[#00bf63]/30 rounded-full px-2 py-0.5">Soon</span>
                                  )}
                                </div>
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
                      "flex items-center gap-2 px-3 py-2 text-sm font-bold transition-all duration-200",
                      isActive
                        ? "text-primary"
                        : "text-gray-700 hover:text-gray-900"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <Link
                to="/docs"
                className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-gray-700 hover:text-gray-900 transition-all duration-200"
              >
                Developers
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#00bf63] border border-[#00bf63]/30 rounded-full px-2 py-0.5">Soon</span>
              </Link>

              <Link
                to="/book-demo"
                className="hidden lg:inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-white bg-[#00bf63] hover:bg-[#00a857] rounded-lg transition-colors shadow-sm ml-4"
              >
                Book a Demo
              </Link>

              {/* User Avatar Dropdown */}
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
                        <a
                          href="https://app.paychain.co.ke"
                          onClick={() => setIsAvatarDropdownOpen(false)}
                          className="w-full block px-4 py-2 text-sm font-bold text-white bg-[#00bf63] hover:bg-[#00a857] transition-colors duration-200 rounded-md text-center shadow-sm"
                        >
                          Sign Up
                        </a>
                      </div>
                    </div>
                  )}
                </div>
            </div>

            {/* Mobile User Avatar */}
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
                      <a
                        href="https://app.paychain.co.ke"
                        onClick={() => setIsAvatarDropdownOpen(false)}
                        className="w-full block px-4 py-2 text-sm font-bold text-white bg-[#00bf63] hover:bg-[#00a857] transition-colors duration-200 rounded-md text-center shadow-sm"
                      >
                        Sign Up
                      </a>
                    </div>
                  </div>
                )}
              </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu — backdrop + slide-out drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <React.Fragment key="mobile-nav">
            <motion.div
              className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeMobileMenu}
              aria-hidden="true"
            />

            <motion.div
              id="mobile-nav-drawer"
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              className="fixed top-0 left-0 z-50 md:hidden h-full w-[85%] max-w-sm bg-white shadow-2xl flex flex-col"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100 shrink-0">
                <Link to="/" onClick={closeMobileMenu} className="flex items-center gap-2">
                  <img src="/Home page/paychain official logo.png" alt="PayChain KE" className="h-6 w-auto mix-blend-multiply" />
                </Link>
                <button
                  className="p-2 -mr-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors duration-200"
                  onClick={closeMobileMenu}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable nav content */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                <div className="space-y-1">
                  {navItems.map((item, index) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;

                    if (item.hasDropdown) {
                      return (
                        <div key={item.path}>
                          <button
                            onClick={() => setIsMobileResourcesDropdownOpen((v) => !v)}
                            aria-expanded={isMobileResourcesDropdownOpen}
                            className="flex items-center justify-between w-full px-3 py-3 rounded-xl text-gray-800 hover:bg-gray-50 transition-colors"
                          >
                            <span className="flex items-center gap-3">
                              <Icon className="w-[18px] h-[18px] text-gray-400" />
                              <span className="font-semibold text-[15px]">{item.label}</span>
                            </span>
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 text-gray-400 transition-transform duration-200",
                                isMobileResourcesDropdownOpen && "rotate-180"
                              )}
                            />
                          </button>
                          <AnimatePresence initial={false}>
                            {isMobileResourcesDropdownOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: 'easeInOut' }}
                                className="overflow-hidden"
                              >
                                <div className="pl-[42px] pr-2 pb-1 space-y-0.5">
                                  {item.dropdownItems?.map((dropdownItem) => (
                                    <Link
                                      key={dropdownItem.path}
                                      to={dropdownItem.path}
                                      onClick={closeMobileMenu}
                                      className="flex items-start gap-2.5 py-2.5 px-2 rounded-lg hover:bg-gray-50 transition-colors group"
                                    >
                                      <span>
                                        <span className="flex items-center gap-2">
                                          <span className="block text-sm font-semibold text-gray-800 group-hover:text-[#00351d]">
                                            {dropdownItem.label}
                                          </span>
                                          {dropdownItem.soon && (
                                            <span className="text-[9px] font-bold uppercase tracking-wider text-[#00bf63] border border-[#00bf63]/30 rounded-full px-1.5 py-0.5">Soon</span>
                                          )}
                                        </span>
                                        {dropdownItem.description && (
                                          <span className="block text-xs text-gray-500 mt-0.5 leading-snug">
                                            {dropdownItem.description}
                                          </span>
                                        )}
                                      </span>
                                    </Link>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    }

                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={closeMobileMenu}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors",
                          isActive ? "bg-[#EAFBF1] text-[#00351d]" : "text-gray-800 hover:bg-gray-50"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className={cn("w-[18px] h-[18px]", isActive ? "text-[#00bf63]" : "text-gray-400")} />
                          <span className="font-semibold text-[15px]">{item.label}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </Link>
                    );
                  })}
                </div>

                <div className="my-3 border-t border-gray-100" />

                {/* Developer API isn't publicly self-serve yet — links to
                    the on-site "coming soon" page (pages/Docs.tsx), not the
                    live docs app, so this doesn't say one thing here and
                    another in the footer/desktop nav. */}
                <Link
                  to="/docs"
                  onClick={closeMobileMenu}
                  className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-gray-800 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-3">
                    <Code2 className="w-[18px] h-[18px] text-gray-400" />
                    <span className="font-semibold text-[15px]">Developer API</span>
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#00bf63] border border-[#00bf63]/30 rounded-full px-2 py-0.5">Coming Soon</span>
                </Link>
              </div>

              {/* CTAs + footer — pinned to the bottom, always reachable
                  regardless of how tall the scrollable content above gets. */}
              <div className="shrink-0 border-t border-gray-100 px-4 pt-4 pb-5 bg-[#FAFDFC]">
                <div className="space-y-2">
                  <Link
                    to="/book-demo"
                    onClick={closeMobileMenu}
                    className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-white bg-[#00bf63] hover:bg-[#00a857] rounded-xl transition-colors shadow-sm"
                  >
                    Book a Demo
                  </Link>
                  <a
                    href="https://app.paychain.co.ke"
                    onClick={closeMobileMenu}
                    className="flex items-center justify-center w-full px-4 py-3 text-sm font-bold text-[#00351d] bg-white border border-[#00351d]/15 hover:bg-[#00351d]/5 rounded-xl transition-colors"
                  >
                    Sign Up Free
                  </a>
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 mt-4">
                  <Copyright className="w-3 h-3" />
                  <span>2026 PayChain KE</span>
                </div>
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
