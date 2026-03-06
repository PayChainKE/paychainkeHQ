import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, TrendingUp, Shield, Zap, FileCheck, Users, Zap as BoltIcon,
  Bell, Settings, ChevronRight, CheckCircle2, AlertTriangle, Home,
  BarChart2, CreditCard, ArrowUpRight, ArrowDownLeft,
  Wallet, Wifi, ToggleRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

/* ─── Sample data ─── */
const revenueData = [
  { day: 'Mon', revenue: 48200, usdc: 373 },
  { day: 'Tue', revenue: 61500, usdc: 476 },
  { day: 'Wed', revenue: 53800, usdc: 416 },
  { day: 'Thu', revenue: 72100, usdc: 558 },
  { day: 'Fri', revenue: 89400, usdc: 692 },
  { day: 'Sat', revenue: 110200, usdc: 853 },
  { day: 'Sun', revenue: 96700, usdc: 748 },
];

const recentTxns = [
  { id: 'TXN-8821', merchant: 'Westgate POS #3', amount: '+KES 12,400', usdc: '+$96.0', time: '2 min ago', status: 'verified' },
  { id: 'TXN-8820', merchant: 'CBD Branch', amount: '+KES 8,750', usdc: '+$67.7', time: '14 min ago', status: 'verified' },
  { id: 'TXN-8819', merchant: 'Mombasa Rd.', amount: '+KES 3,200', usdc: '+$24.7', time: '1 hr ago', status: 'verified' },
  { id: 'TXN-8818', merchant: 'Kikuyu Town', amount: '-KES 1,100', usdc: '-$8.5', time: '2 hr ago', status: 'blocked' },
  { id: 'TXN-8817', merchant: 'Thika Road Mall', amount: '+KES 22,000', usdc: '+$170.2', time: '3 hr ago', status: 'verified' },
];

const quickActions = [
  { icon: Zap, label: 'Pay Electricity', sub: 'Kenya Power', color: 'text-yellow-500 bg-yellow-50' },
  { icon: Wifi, label: 'Buy Airtime', sub: 'Safaricom / Airtel', color: 'text-blue-500 bg-blue-50' },
  { icon: Users, label: 'Run Payroll', sub: '12 employees', color: 'text-purple-500 bg-purple-50' },
  { icon: FileCheck, label: 'Submit ETR', sub: 'KRA e-TIMS', color: 'text-emerald-600 bg-emerald-50' },
  { icon: CreditCard, label: 'Pay Rent', sub: 'Nairobi BD', color: 'text-red-500 bg-red-50' },
  { icon: Wallet, label: 'USDC Swap', sub: 'KES → USDC', color: 'text-indigo-500 bg-indigo-50' },
];

/* ─── Stat Card ─── */
interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  delta?: string;
  positive?: boolean;
  icon: React.ElementType;
  accent?: string;
}
const StatCard: React.FC<StatCardProps> = ({ label, value, sub, delta, positive = true, icon: Icon, accent = 'bg-emerald-50 text-emerald-600' }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
      {delta && (
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${positive ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
          {positive ? '+' : ''}{delta}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900 mb-0.5">{value}</p>
    <p className="text-xs text-gray-500 font-medium">{label}</p>
    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
  </div>
);

/* ─── Custom Tooltip ─── */
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-600 mb-1">{label}</p>
      <p className="text-emerald-600 font-bold">KES {payload[0]?.value?.toLocaleString()}</p>
      <p className="text-blue-500">${payload[1]?.value} USDC</p>
    </div>
  );
};

/* ─── Dashboard Page ─── */
const Dashboard: React.FC = () => {
  const [inflationShield, setInflationShield] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');

  const sideNavItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/' },
    { id: 'dashboard', icon: BarChart2, label: 'Dashboard', path: '/dashboard' },
    { id: 'payments', icon: CreditCard, label: 'Payments', path: '#' },
    { id: 'payroll', icon: Users, label: 'Payroll', path: '#' },
    { id: 'compliance', icon: FileCheck, label: 'e-TIMS', path: '#' },
    { id: 'sentinel', icon: Shield, label: 'Sentinel AI', path: '#' },
  ];

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]" style={{ background: '#F8FAFC' }}>

      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r border-gray-100 bg-[#0A192F] flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="PayChain KE" className="h-7 w-auto" />
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {sideNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeNav;
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setActiveNav(item.id)}
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

        {/* Quick Actions panel */}
        <div className="px-4 py-5 border-t border-white/10">
          <p className="text-xs font-semibold text-white/25 uppercase tracking-widest mb-3">Quick Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            {quickActions.slice(0, 4).map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl text-center transition-all hover:bg-white/8 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/8 flex items-center justify-center group-hover:bg-emerald-500/10 transition-colors">
                    <Icon className="w-4 h-4 text-white/50 group-hover:text-emerald-400 transition-colors" />
                  </div>
                  <span className="text-[10px] text-white/40 leading-tight group-hover:text-white/60 transition-colors">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom user section */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <img src="/avator.png" alt="User" className="w-8 h-8 rounded-full object-cover border border-white/20" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">Merchant Account</p>
              <p className="text-[10px] text-white/35 truncate">VASP Verified</p>
            </div>
            <Settings className="w-4 h-4 text-white/30 hover:text-white/60 cursor-pointer flex-shrink-0 transition-colors" />
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="lg:hidden">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div>
              <h1 className="text-base font-bold text-gray-900">Overview</h1>
              <p className="text-xs text-gray-400">Thursday, 5 March 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Inflation Shield toggle */}
            <button
              onClick={() => setInflationShield(s => !s)}
              className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-colors text-sm"
              style={inflationShield
                ? { background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.25)', color: '#059669' }
                : { background: '#f9fafb', borderColor: '#e5e7eb', color: '#6b7280' }}
            >
              <Shield className="w-4 h-4" />
              <span className="font-medium text-xs">Inflation Shield</span>
              <div className={`relative w-8 h-4 rounded-full transition-colors ${inflationShield ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${inflationShield ? 'left-4' : 'left-0.5'}`} />
              </div>
            </button>
            <button className="relative w-9 h-9 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors">
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">

          {/* Savings narrative banner */}
          {inflationShield && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border"
              style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  You saved <span className="text-emerald-600">KES 4,500</span> from inflation today
                </p>
                <p className="text-xs text-gray-500">
                  Inflation Shield converted KES 58,200 → $450 USDC at peak rate · <span className="text-emerald-600 font-medium">KES 129.3</span>
                </p>
              </div>
              <div className="ml-auto flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
            </motion.div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Today's Revenue"
              value="KES 96,700"
              sub="vs KES 89,400 yesterday"
              delta="8.2%"
              positive
              icon={TrendingUp}
              accent="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="USDC Balance"
              value="$4,821.50"
              sub="≈ KES 623,450"
              delta="$12.40"
              positive
              icon={Wallet}
              accent="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Threats Blocked"
              value="3"
              sub="Sentinel AI · Today"
              icon={Shield}
              accent="bg-red-50 text-red-500"
            />
            <StatCard
              label="e-TIMS Status"
              value="98.6%"
              sub="Compliance score · KRA"
              delta="0.2%"
              positive
              icon={FileCheck}
              accent="bg-purple-50 text-purple-600"
            />
          </div>

          {/* Chart + Quick Actions */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Weekly Revenue</h2>
                  <p className="text-xs text-gray-400 mt-0.5">KES & USDC · Last 7 days</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />KES</div>
                  <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400" />USDC</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={revenueData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id="green" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fill="url(#green)" dot={false} />
                  <Area type="monotone" dataKey="usdc" stroke="#3b82f6" strokeWidth={2} fill="url(#blue)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Quick Actions panel */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all group text-left"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${action.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{action.label}</p>
                        <p className="text-xs text-gray-400">{action.sub}</p>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Recent Transactions</h2>
                <p className="text-xs text-gray-400 mt-0.5">Blockchain-anchored · Immutable</p>
              </div>
              <button className="text-xs text-emerald-600 font-semibold hover:underline">View all</button>
            </div>
            <div className="divide-y divide-gray-50">
              {recentTxns.map((txn) => (
                <div key={txn.id} className="flex items-center px-6 py-4 hover:bg-gray-50/60 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      txn.status === 'verified' ? 'bg-emerald-50' : 'bg-red-50'
                    }`}>
                      {txn.status === 'verified'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <AlertTriangle className="w-4 h-4 text-red-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{txn.merchant}</p>
                      <p className="text-xs text-gray-400">{txn.id} · {txn.time}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className={`text-sm font-bold ${txn.amount.startsWith('+') ? 'text-gray-900' : 'text-red-500'}`}>{txn.amount}</p>
                    <p className="text-xs text-gray-400">{txn.usdc}</p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      txn.status === 'verified'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-red-50 text-red-500'
                    }`}>
                      {txn.status === 'verified' ? 'Verified' : 'Blocked'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust badges row */}
          <div className="flex flex-wrap gap-3 pb-2">
            {['VASP 2025 Compliant', 'Partnered with Equity Bank', 'KRA e-TIMS Native', 'Base L2 Anchored', 'AES-256 Encrypted'].map((badge) => (
              <div key={badge} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                {badge}
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;
