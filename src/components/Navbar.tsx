import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutDashboard, FileCode, GitBranch, Menu, X, Wallet, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const Navbar: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/architecture', label: 'Architecture', icon: GitBranch },
    { path: '/docs', label: 'Docs', icon: FileCode },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-cyan-900/20"></div>
      <div className="container mx-auto px-6 relative">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="relative">
              <img src="/logo.png" alt="PayChain KE Logo" className="h-8 w-auto" />
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
              pay<span className="text-cyan-400">Chain</span>KE
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-300 rounded-lg group",
                    isActive
                      ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20"
                      : "text-gray-300 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 rounded-lg animate-pulse"></div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Web3 Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-sm font-medium rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/25">
              <Wallet className="w-4 h-4" />
              Connect Wallet
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <Zap className="w-3 h-3" />
              Base L2
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-white hover:text-cyan-400 transition-colors duration-300"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-black/95 backdrop-blur-xl">
            <div className="px-4 py-6 space-y-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 text-base font-medium transition-all duration-300 rounded-lg group",
                      isActive
                        ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20"
                        : "text-gray-300 hover:text-white hover:bg-white/5"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
              {/* Mobile Web3 Actions */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-sm font-medium rounded-lg transition-all duration-300">
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </button>
                <div className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <Zap className="w-3 h-3" />
                  Base L2
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
