import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mockMerchant } from '../../mockData/merchant'
import { useMerchantAuth } from '../../context/MerchantAuthContext'
import userIcon from '../../assets/user-icon.png'

export default function MerchantHeader({ title, onMenuClick }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const { logout } = useMerchantAuth()
  const unread = mockMerchant.notifications.filter(n => !n.isRead).length

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }
  
  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[240px] h-[64px] lg:h-[56px] z-40 bg-white/90 backdrop-blur-md flex justify-between items-center px-4 lg:px-8 border-b border-outline-variant/15 glass-header transition-all">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 hover:bg-emerald-50 rounded-full text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-primary font-black text-sm lg:text-base tracking-tight truncate max-w-[120px] lg:max-w-none">{title}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Link 
          to="/notifications"
          className="hover:bg-emerald-50 rounded-full p-2 transition-all duration-300 relative group"
        >
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-2xl">notifications</span>
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] bg-red-600 rounded-full flex items-center justify-center text-[10px] font-black text-white px-1 ring-2 ring-white animate-pulse-subtle shadow-lg">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Link>
        
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`flex items-center gap-2 p-1 lg:p-1.5 rounded-full transition-all duration-300 ${isDropdownOpen ? 'bg-emerald-50 ring-2 ring-emerald-500/20' : 'hover:bg-emerald-50'}`}
          >
            <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 overflow-hidden border border-emerald-500/10">
              <img src={userIcon} alt="User" className="w-full h-full object-cover" />
            </div>
            <span className="material-symbols-outlined text-on-surface-variant text-sm lg:text-base transition-transform duration-300" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              expand_more
            </span>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-56 lg:w-64 bg-white/95 backdrop-blur-xl border border-outline-variant/15 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-2xl py-2 z-[60] animate-fade-in-down origin-top-right overflow-hidden">
              <div className="px-4 py-3 border-b border-outline-variant/10 mb-1 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-emerald-500/10 overflow-hidden shrink-0">
                  <img src={userIcon} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-primary uppercase tracking-widest mb-0.5 truncate">{mockMerchant.businessName}</p>
                  <p className="text-[10px] text-on-surface-variant font-medium opacity-60 truncate">{mockMerchant.email}</p>
                </div>
              </div>
              
              <Link 
                to="/profile" 
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-on-surface-variant hover:bg-emerald-50 hover:text-primary transition-all group"
              >
                <span className="material-symbols-outlined text-xl opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all">person</span>
                Business Profile
              </Link>
              
              <Link 
                to="/trust-score" 
                onClick={() => setIsDropdownOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm font-bold text-on-surface-variant hover:bg-emerald-50 hover:text-primary transition-all group"
              >
                <span className="material-symbols-outlined text-xl opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all">verified_user</span>
                Trust Score
              </Link>
              
              <div className="h-px bg-outline-variant/10 my-1"></div>
              
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-error hover:bg-red-50 transition-all group"
              >
                <span className="material-symbols-outlined text-xl opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all">logout</span>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
