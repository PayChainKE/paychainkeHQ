import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Shield, FileCheck, Briefcase, CreditCard, TrendingUp, Users, Settings, ChevronRight } from 'lucide-react';

const sideNavItems = [
  { id: 'overview', icon: Home, label: 'Overview', path: '/dashboard' },
  { id: 'tills', icon: ShoppingBag, label: 'My Tills', path: '/dashboard/tills' },
  { id: 'inflation-shield', icon: Shield, label: 'Inflation Shield', path: '/dashboard/inflation-shield' },
  { id: 'etims', icon: FileCheck, label: 'e-TIMS Hub', path: '/dashboard/etims' },
  { id: 'escrow', icon: Briefcase, label: 'Supplier Escrow', path: '/dashboard/escrow' },
  { id: 'payments', icon: CreditCard, label: 'Payments', path: '/dashboard/payments' },
  { id: 'cash-advance', icon: TrendingUp, label: 'Cash Advance', path: '/dashboard/cash-advance' },
  { id: 'payroll', icon: Users, label: 'Payroll & Utilities', path: '/dashboard/payroll' },
  { id: 'settings', icon: Settings, label: 'Settings', path: '/dashboard/settings' },
];

const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]" style={{ background: '#F8FAFC' }}>
      <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r border-gray-100 bg-[#0A192F] flex-shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="PayChain KE" className="h-7 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          {sideNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-emerald-400/60" />}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col min-h-screen">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
