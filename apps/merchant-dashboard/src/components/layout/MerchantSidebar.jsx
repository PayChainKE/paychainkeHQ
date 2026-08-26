import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { usePrivacyMode } from '../../hooks/usePrivacyMode'
import { useMerchantAuth } from '../../context/MerchantAuthContext'
import { useNotification } from '../../context/NotificationContext'
import { formatKES } from '../../utils/formatCurrency'
import { formatAccountNumber } from '../../utils/formatAccountNumber'
import userIcon from '../../assets/user-icon.png'
import logo from '../../assets/logo2.png'

const baseNavItems = [
  { name: 'Overview', icon: 'dashboard', path: '/overview' },
  { name: 'Transactions', icon: 'receipt_long', path: '/transactions' },
  { name: 'Bulk Payments', icon: 'group_add', path: '/bulk-pay' },
  { name: 'Invoices', icon: 'receipt_long', path: '/invoices' },
  // Digital Wallet / Inflation Shield nav entry removed for now — the
  // feature stays live only in apps/demo (the sandbox/prospect-facing
  // showcase). Routes (/wallet, /inflation-shield) and their FeatureGuard
  // are left in place so a re-enable is just adding this entry back, not a
  // rebuild — see App.jsx.
  {
    name: 'Cash Advance',
    icon: 'payments',
    path: '/cash-advance',
    showOverview: false,
  },
  { name: 'My Accounts', icon: 'point_of_sale', path: '/accounts' },
  { name: 'Settings', icon: 'settings', path: '/profile' },
  { name: 'Support', icon: 'help_outline', path: '/support' },
]

function NavItem({ item, depth = 0 }) {
  const [isOpen, setIsOpen] = React.useState(true) // Default open for better visibility
  const hasChildren = item.children && item.children.length > 0

  if (hasChildren) {
    return (
      <div className="flex flex-col">
        <NavLink 
          to={item.path}
          onClick={() => setIsOpen(!isOpen)}
          className={({ isActive }) => 
            `flex items-center justify-between py-3.5 px-6 cursor-pointer transition-all relative group ${
              isActive 
              ? 'text-[#5EFEB3] bg-[#0E3D2E] font-bold after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-[#5EFEB3]' 
              : 'text-[#c0c9c0] hover:text-white hover:bg-emerald-900/40'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined transition-colors text-xl ${isActive ? 'text-[#5EFEB3]' : 'opacity-60 group-hover:opacity-100'}`}>
                  {item.icon}
                </span>
                <span className="font-bold text-xs tracking-wide">{item.name}</span>
              </div>
              <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </>
          )}
        </NavLink>
        
        {isOpen && (
          <div className="bg-[#0D241E]/40 border-l border-white/5 ml-4">
            {item.showOverview !== false && (
              <NavLink
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 py-3 px-6 transition-all relative group ${
                    isActive 
                    ? 'text-[#5EFEB3] bg-[#0E3D2E]/60 font-bold' 
                    : 'text-[#a8b3a8] hover:text-white hover:bg-emerald-900/20'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`material-symbols-outlined transition-colors text-lg ${isActive ? 'text-[#5EFEB3]' : 'text-inherit opacity-40 group-hover:opacity-80'}`}>
                      account_balance
                    </span>
                    <span className="font-bold text-[11px] tracking-wide">{item.overviewLabel || 'Overview'}</span>
                  </>
                )}
              </NavLink>
            )}
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) => 
                  `flex items-center gap-3 py-3 px-6 transition-all relative group ${
                    isActive 
                    ? 'text-[#5EFEB3] bg-[#0E3D2E]/60 font-bold' 
                    : 'text-[#a8b3a8] hover:text-white hover:bg-emerald-900/20'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`material-symbols-outlined transition-colors text-lg ${isActive ? 'text-[#5EFEB3]' : 'text-inherit opacity-40 group-hover:opacity-80'}`}>
                      {child.icon}
                    </span>
                    <span className="font-bold text-[11px] tracking-wide">{child.name}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <NavLink
      key={item.path}
      to={item.path}
      className={({ isActive }) => 
        `flex items-center gap-3 py-3.5 px-6 transition-all relative group ${
          isActive 
          ? 'text-[#5EFEB3] bg-[#0E3D2E] font-bold after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-[#5EFEB3]' 
          : 'text-[#c0c9c0] hover:text-white hover:bg-emerald-900/40'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={`material-symbols-outlined transition-colors text-xl ${isActive ? 'text-[#5EFEB3]' : 'text-inherit opacity-60 group-hover:opacity-100'}`}>
            {item.icon}
          </span>
          <span className="font-bold text-xs tracking-wide">{item.name}</span>
        </>
      )}
    </NavLink>
  )
}

export default function MerchantSidebar({ isOpen, onClose }) {
  const { showAmounts } = usePrivacyMode()
  const { merchant, logout } = useMerchantAuth()
  const { unreadCount } = useNotification()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`fixed left-0 top-0 h-full w-[240px] z-[50] bg-[#162723] flex flex-col overflow-y-auto transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
      {/* Close Button Mobile Only */}
      <button 
        onClick={onClose}
        className="lg:hidden absolute top-6 right-6 text-white/40 hover:text-white"
      >
        <span className="material-symbols-outlined">close</span>
      </button>
      {/* Brand & Identity Header */}
      <div className="p-6">
        <div className="mb-8 lg:flex lg:justify-center">
          <img src={logo} alt="PayChain Logo" className="h-8 max-w-full w-auto object-contain" />
        </div>
        
        {/* Separator Line */}
        <div className="h-px bg-white/10 mb-8 w-full" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center overflow-hidden border border-white/10 shadow-sm">
            <img 
              alt="Merchant Profile Avatar" 
              className="w-full h-full object-cover" 
              src={userIcon}
            />
          </div>
          <div>
            <p className="text-white text-xs font-bold leading-tight truncate w-[130px]">{merchant?.businessName || 'Admin'}</p>
            <p className="text-[#a8b3a8] text-[9px] uppercase tracking-wider mt-0.5">ACC: {formatAccountNumber(merchant?.ncbaVirtualAccountNumber || merchant?.ncbaMerchantCode || 'Pending')}</p>
          </div>
        </div>

        {/* Post-Info Separator */}
        <div className="h-px bg-white/5 mt-8 w-full" />
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 mt-6">
        {(() => {
          const merchantFeatures = merchant?.features || {};
          
          return baseNavItems.map(item => {
            // Check parent feature flag
            if (item.featureKey && merchantFeatures[item.featureKey] === false) {
              return null;
            }
            
            // Clone item to filter children
            let filteredItem = { ...item };
            if (filteredItem.children) {
              filteredItem.children = filteredItem.children.filter(child => 
                !child.featureKey || merchantFeatures[child.featureKey] !== false
              );
            }
            
            return <NavItem key={filteredItem.path} item={filteredItem} />;
          });
        })()}
      </nav>

      {/* Available Funds Box & Footer Actions */}
      <div className="p-6 mt-auto">
        <div className="bg-[#0D241E] rounded-[16px] p-5 mb-8 border border-white/5">
          <p className="text-[#5EFEB3] text-[9px] font-bold uppercase tracking-widest mb-2">Available Funds</p>
          <p className={`text-white font-headline text-2xl tracking-tight mb-0.5 transition-all duration-300 ${!showAmounts && 'blur-md'}`}>{formatKES(merchant?.kesBalance ?? 0)}</p>
        </div>

        <div className="space-y-1 pt-4 border-t border-white/5">
          <NavLink to="/notifications" className="flex items-center justify-between text-[#c0c9c0] hover:text-white py-2 px-1 transition-colors group">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-lg opacity-60 group-hover:opacity-100 transition-opacity">notifications</span>
              <span className="text-xs">Notifications</span>
            </div>
            {unreadCount > 0 && (
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
            )}
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 text-[#c0c9c0] hover:text-white py-2 px-1 transition-colors group"
          >
            <span className="material-symbols-outlined text-lg opacity-60 group-hover:opacity-100 transition-opacity">logout</span>
            <span className="text-xs">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
