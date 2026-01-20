import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  CreditCard,
  Shield,
  Settings,
  Lock,
  User,
  CheckCircle,
  TrendingUp,
  Activity,
  DollarSign,
  Home
} from 'lucide-react';
import { Link } from 'react-router-dom';
import WaitlistForm from '@/components/WaitlistForm';

const Dashboard: React.FC = () => {
  const navItems = [
    { icon: Home, label: 'Home', active: false, locked: false, path: '/' },
    { icon: LayoutDashboard, label: 'Dashboard', active: true, locked: true },
    { icon: CreditCard, label: 'Transactions', locked: true },
    { icon: Shield, label: 'e-TIMS Sync', locked: true },
    { icon: Shield, label: 'Sentinel Shield', locked: true },
    { icon: Settings, label: 'Settings', locked: true },
  ];

  const statCards = [
    { title: 'Total Verified Revenue', icon: DollarSign, value: 'KES 0.00' },
    { title: 'Truth Pings Today', icon: Activity, value: '0' },
    { title: 'Sentinel Blocks', icon: Shield, value: '0' },
  ];

  const shimmerVariants = {
    shimmer: {
      background: [
        'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
        'linear-gradient(90deg, transparent 100%, rgba(255,255,255,0.1) 50%, transparent 0%)',
      ],
      backgroundSize: '200% 100%',
      transition: { duration: 1.5, repeat: Infinity },
    },
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white flex flex-col md:flex-row">
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <aside className="hidden md:block w-64 bg-[#111827]/50 backdrop-blur-md border-r border-white/10 p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#10B981]">PayChainKE</h1>
        </div>
        <nav className="space-y-2">
          {navItems.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              {item.path ? (
                <Link to={item.path} className="flex items-center gap-3 flex-1">
                  <item.icon className="w-5 h-5 text-[#10B981]" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-3 flex-1">
                  <item.icon className="w-5 h-5 text-[#10B981]" />
                  <span className="text-sm">{item.label}</span>
                </div>
              )}
              {item.locked && <Lock className="w-4 h-4 text-slate-400" />}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Mobile responsive */}
        <header className="bg-[#111827]/50 backdrop-blur-md border-b border-white/10 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              {/* Mobile Home Button */}
              <div className="md:hidden">
                <Link to="/">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
                    title="Back to Home"
                  >
                    <Home className="w-5 h-5" />
                    <span className="text-sm font-medium">Home</span>
                  </motion.button>
                </Link>
              </div>
              <div className="w-10 h-10 bg-[#10B981] rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold truncate">Welcome back</h2>
                <p className="text-sm text-slate-400 truncate">Merchant Dashboard</p>
              </div>
            </div>
            <div className="bg-[#10B981]/20 text-[#10B981] px-3 py-2 rounded-full text-xs md:text-sm font-medium border border-[#10B981]/30 text-center whitespace-nowrap">
              System Status: V1 Beta Testing (Q3 2026)
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* Stats Cards - Mobile responsive grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {statCards.map((card, index) => (
              <motion.div
                key={index}
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 md:p-6 relative overflow-hidden"
                variants={shimmerVariants}
                animate="shimmer"
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <card.icon className="w-6 h-6 md:w-8 md:h-8 text-[#10B981]" />
                  <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-slate-400" />
                </div>
                <h3 className="text-sm md:text-lg font-semibold mb-1 md:mb-2">{card.title}</h3>
                <p className="text-xl md:text-2xl font-bold text-[#10B981]">{card.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Transactions Table - Mobile responsive */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold mb-4">Recent Transactions</h3>
            <div className="overflow-x-auto -mx-4 md:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">Amount</th>
                      <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">Till Number</th>
                      <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">Time</th>
                      <th className="text-left py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((row) => (
                      <motion.tr
                        key={row}
                        className="border-b border-white/5"
                        variants={shimmerVariants}
                        animate="shimmer"
                      >
                        <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">KES 0.00</td>
                        <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">000000</td>
                        <td className="py-2 md:py-3 px-2 md:px-4 text-xs md:text-sm">--:--:--</td>
                        <td className="py-2 md:py-3 px-2 md:px-4">
                          <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-[#10B981]" />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* e-TIMS Status Card - Mobile responsive */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 md:p-6">
            <h3 className="text-lg md:text-xl font-semibold mb-4">e-TIMS Synchronization</h3>
            <div className="space-y-3 md:space-y-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="text-sm md:text-base">Finalizing KRA Handshake</span>
                <span className="text-[#10B981] font-semibold text-sm md:text-base">95%</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div className="bg-[#10B981] h-2 rounded-full" style={{ width: '95%' }}></div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Under Construction Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 md:p-8 max-w-sm md:max-w-md w-full mx-4 text-center relative"
        >
          {/* Close/Home Button */}
          <Link to="/" className="absolute top-3 md:top-4 right-3 md:right-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="flex items-center gap-2 p-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
              title="Back to Home"
            >
              <Home className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-sm font-medium">Home</span>
            </motion.button>
          </Link>

          <Shield className="w-12 h-12 md:w-16 md:h-16 text-[#10B981] mx-auto mb-3 md:mb-4" />
          <h2 className="text-xl md:text-2xl font-bold mb-3 md:mb-4 px-2">The Truth Layer is Synchronizing</h2>
          <p className="text-slate-300 mb-4 md:mb-6 text-sm md:text-base px-2">
            We are currently finalizing the Rust-to-Blockchain anchoring for the Q3/Q4 2026 pilot.
            Your dashboard will be live once the testing window opens.
          </p>
          <WaitlistForm />
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
