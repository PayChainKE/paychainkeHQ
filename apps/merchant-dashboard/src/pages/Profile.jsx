import React, { useState } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useToast } from '../context/NotificationContext'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import axios from 'axios'

export default function Profile() {
  const { showAmounts } = usePrivacyMode()
  const { merchant } = useMerchantAuth()
  const [name, setName] = useState(merchant?.name || 'Admin')
  const [email, setEmail] = useState(merchant?.email || 'admin@paychain.ke')
  const [kraPin, setKraPin] = useState(merchant?.kraPin || '')
  const [businessNumber, setBusinessNumber] = useState(merchant?.businessNumber || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false)
  const toast = useToast()

  async function save() {
    setIsUpdatingProfile(true)
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.put(`${API_URL}/api/auth/merchant/profile`, {
        kraPin,
        businessNumber
      })

      if (res.data.success) {
        toast.push({ message: 'Profile updated successfully', type: 'success' })
        // Need to wait slightly for the UI to show success before refreshing context
        setTimeout(() => window.location.reload(), 1000)
      }
    } catch (err) {
      toast.push({ message: err.response?.data?.error || 'Failed to update profile', type: 'error' })
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  async function handleSecurityUpdate() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.push({ message: 'Please fill out all password fields', type: 'error' })
      return
    }

    if (newPassword !== confirmPassword) {
      toast.push({ message: 'New password and confirm password do not match', type: 'error' })
      return
    }

    if (newPassword.length < 8) {
      toast.push({ message: 'New password must be at least 8 characters long', type: 'error' })
      return
    }

    setIsUpdatingSecurity(true)
    try {
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.put(`${API_URL}/api/auth/merchant/change-password`, {
        currentPassword,
        newPassword
      })

      if (res.data.success) {
        toast.push({ message: 'Password updated successfully', type: 'success' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      toast.push({ message: err.response?.data?.error || 'Failed to update password', type: 'error' })
    } finally {
      setIsUpdatingSecurity(false)
    }
  }

  const loginHistory = []

  return (
    <MerchantLayout title="Settings">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 lg:mb-10">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight">Settings</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80">Manage your business profile, settlement rules, and security preferences.</p>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Settings Area */}
          <div className="col-span-12 lg:col-span-8 space-y-8">
            
            {/* Section 1: Administrator Profile */}
            <div className="bg-white p-6 lg:p-10 rounded-[32px] lg:rounded-[40px] border border-slate-100 shadow-sm editorial-shadow animate-fade-in-up [animation-delay:100ms]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="font-headline font-bold text-2xl text-primary tracking-tight">Profile</h3>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-[0.2em] mt-1 opacity-60">Identity Management</p>
                </div>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-700 px-4 py-1.5 rounded-full font-black uppercase tracking-widest border border-emerald-500/10 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Identity Verified
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 lg:gap-y-8 gap-x-12">
                {[
                  { label: "Name", value: merchant?.businessName || "N/A", locked: true },
                  { label: "Email", value: merchant?.email || "N/A", locked: false },
                  { label: "Phone", value: merchant?.phone || "N/A", locked: true, badge: "Username" },
                  { label: "Role", value: "Administrator", badge: "Primary" },
                  { label: "Primary contact", value: "Yes", status: true },
                  { label: "Created at", value: merchant?.createdAt ? new Date(merchant.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), sub: "Member since" },
                  { label: "Last sign in", value: merchant?.lastLogin ? new Date(merchant.lastLogin).toLocaleString('en-GB') : new Date().toLocaleString('en-GB'), sub: "Security timestamp" },
                  { label: "Sign in count", value: merchant?.loginCount?.toString() || "1", sub: "Access frequency" },
                  { label: "SMS/USSD activated", value: "No", status: false },
                  { label: "2FA Setup", value: "Yes", status: true },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-2 group">
                    <label className="text-[9px] text-on-surface-variant font-black uppercase tracking-[0.2em] pl-1 opacity-50 group-hover:opacity-100 transition-opacity">{item.label}</label>
                    <div className="relative">
                      <div className={`w-full bg-surface-container-low/30 border border-slate-100 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] rounded-2xl py-3.5 px-5 text-sm font-black text-primary flex items-center justify-between ${item.locked ? 'opacity-70 bg-surface-container-low/10' : 'group-hover:border-primary/20 group-hover:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.1)]'} transition-all duration-300`}>
                        <span className={!showAmounts && item.label === "Phone" ? 'blur-md' : ''}>{item.value}</span>
                        {item.locked && <span className="material-symbols-outlined text-xs opacity-30">lock</span>}
                        {item.badge && <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{item.badge}</span>}
                        {item.status !== undefined && (
                          <div className={`w-2 h-2 rounded-full ${item.status ? 'bg-emerald-500' : 'bg-red-400'} shadow-[0_0_8px_rgba(0,0,0,0.1)]`}></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 lg:gap-y-8 gap-x-12 mt-8 border-t border-slate-100 pt-8">
                <div className="space-y-2 group">
                  <label className="text-[9px] text-on-surface-variant font-black uppercase tracking-[0.2em] pl-1 opacity-50 group-hover:opacity-100 transition-opacity">KRA PIN</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={kraPin}
                      onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                      placeholder="e.g. P123456789A"
                      className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none pr-32"
                    />
                    {merchant?.isKRAVerified && merchant?.kraPin === kraPin && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-1.5 rounded-lg border border-emerald-100 shadow-[0_2px_10px_rgba(16,185,129,0.1)] pointer-events-none">
                        <span className="material-symbols-outlined text-[14px]">verified_user</span>
                        <span className="text-[8px] font-black uppercase tracking-widest">eTIMS Verified</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2 group">
                  <label className="text-[9px] text-on-surface-variant font-black uppercase tracking-[0.2em] pl-1 opacity-50 group-hover:opacity-100 transition-opacity">Business / License Number</label>
                  <input 
                    type="text"
                    value={businessNumber}
                    onChange={(e) => setBusinessNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. PVT-XXXXXX"
                    className="w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none"
                  />
                </div>
              </div>
              
              <div className="mt-10 lg:mt-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pt-8 border-t border-slate-100">
                <p className="text-[10px] text-on-surface-variant font-medium max-w-[240px]">Last USSD PIN failed attempts: <span className="text-primary font-black">0</span> • PIN Blocked: <span className="text-red-500 font-black">No</span></p>
                <button 
                  onClick={save}
                  disabled={isUpdatingProfile}
                  className="w-full md:w-auto bg-[#06201B] text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingProfile ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      Updating...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">sync</span>
                      Update Global Profile
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Section 2: Security & Authentication */}
            <div className="bg-[#06201B] p-6 lg:p-10 rounded-[32px] lg:rounded-[40px] text-white shadow-2xl relative animate-fade-in-up [animation-delay:200ms]">
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h3 className="font-headline font-bold text-2xl text-white tracking-tight">Security</h3>
                    <p className="text-[10px] text-emerald-400/60 font-black uppercase tracking-[0.2em] mt-1">Encryption & Access Rules</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-emerald-400 border border-white/5">
                    <span className="material-symbols-outlined text-2xl">shield_locked</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* Change Password Sub-section */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                       Change your password
                    </h4>
                    
                      <div className="space-y-2">
                        <label className="text-[9px] text-white/40 font-black uppercase tracking-widest pl-1">Current password</label>
                        <input 
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-5 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] text-white/40 font-black uppercase tracking-widest pl-1">New password</label>
                        <input 
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-5 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] text-white/40 font-black uppercase tracking-widest pl-1">Confirm new password</label>
                        <input 
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-5 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                  </div>

                  {/* Advanced Auth Sub-section */}
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <h4 className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Advanced Methods
                      </h4>
                      
                      <button 
                        onClick={() => setShowQuestions(true)}
                        className="w-full flex items-center justify-between p-5 bg-white/5 rounded-[24px] border border-white/5 hover:bg-white/[0.08] transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/60 group-hover:text-amber-400">
                            <span className="material-symbols-outlined">quiz</span>
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-black text-white">Security Questions</p>
                            <p className="text-[10px] text-white/30 font-medium">3 questions configured</p>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-white/20">chevron_right</span>
                      </button>

                    </div>

                    <div className="p-5 bg-amber-500/5 rounded-[24px] border border-amber-500/10">
                       <div className="flex gap-4">
                         <span className="material-symbols-outlined text-amber-500 text-lg">help</span>
                         <p className="text-[10px] text-amber-200/50 leading-relaxed font-medium">
                           Need help with your security keys? Reach out to your account manager or use the encrypted support portal.
                         </p>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex justify-end">
                  <button 
                    onClick={handleSecurityUpdate}
                    disabled={isUpdatingSecurity}
                    className="bg-emerald-500 text-[#06201B] px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl hover:bg-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isUpdatingSecurity ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                        Updating Vault...
                      </>
                    ) : (
                      'Update Security Vault'
                    )}
                  </button>
                </div>
              </div>

              {/* Security Questions Form Overlay */}
              {showQuestions && (
                <div className="fixed inset-0 lg:absolute z-[100] lg:z-50 bg-[#06201B] p-6 lg:p-10 rounded-none lg:rounded-[40px] animate-fade-in duration-300 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setShowQuestions(false)}
                        className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined">arrow_back</span>
                      </button>
                      <div>
                        <h3 className="font-headline text-2xl text-white tracking-tight">Security Questions</h3>
                        <p className="text-[10px] text-emerald-400/60 font-black uppercase tracking-[0.2em] mt-1">Identity Recovery Vault</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 sm:p-5 rounded-2xl mb-6 lg:mb-8 shrink-0">
                    <p className="text-[11px] sm:text-xs text-emerald-100/60 font-medium leading-relaxed">
                      Security questions protect your account from fraudsters and aid account recovery if you forget your password or get locked out.
                    </p>
                  </div>

                  <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                    {[
                      "What is the name of the first school you attended?",
                      "What is the name of your favorite musician or band?",
                      "What was the make and model of your first car?"
                    ].map((q, i) => (
                      <div key={i} className="space-y-3">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                          Question {i + 1}
                        </label>
                        <p className="text-sm font-black text-white px-1">{q}</p>
                        <input 
                          type="text"
                          placeholder="Provide your answer"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-5 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 lg:mt-10 flex justify-end gap-3 sm:gap-4 shrink-0 border-t border-white/5 pt-6">
                    <button 
                      onClick={() => setShowQuestions(false)}
                      className="px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white/40 hover:text-white transition-all underline decoration-emerald-500/20 underline-offset-8"
                    >
                      Go back
                    </button>
                    <button 
                      onClick={() => {
                        setShowQuestions(false)
                        toast.push({ message: 'Security questions synchronized' })
                      }}
                      className="bg-emerald-500 text-[#06201B] px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl hover:bg-white transition-all active:scale-95"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="col-span-12 lg:col-span-4 space-y-8">
            
            {/* Merchant ID Card */}
            <div className="bg-[#0A2540] p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white mb-6">
                  <span className="material-symbols-outlined text-2xl">id_card</span>
                </div>
                <h4 className="text-[10px] text-blue-200/60 font-bold uppercase tracking-widest mb-1">Merchant Identity</h4>
                <p className={`font-headline text-2xl lg:text-3xl mb-1 transition-all duration-300 ${!showAmounts && 'blur-md'}`}>ACC: {merchant?.paybillAccount || '84729'}</p>
                <p className="text-sm text-blue-100/60 font-medium">Verified Merchant since Oct 2025</p>
                <div className="mt-8 pt-8 border-t border-white/10 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400 text-sm" style={{fontVariationSettings: "'FILL' 1"}}>check_circle</span>
                  <span className="text-xs font-bold uppercase tracking-widest">Active Status</span>
                </div>
              </div>
            </div>

            {/* Security Mini-Bento */}
            <div className="bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/10 shadow-sm editorial-shadow">
              <h3 className="font-headline font-bold text-lg text-primary mb-6">Security History</h3>
              <div className="space-y-6">
                {loginHistory.length === 0 ? (
                  <p className="text-sm text-on-surface-variant font-medium text-center py-4 opacity-70">No recent security events.</p>
                ) : (
                  loginHistory.map((log, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-sm">{log.device.includes('iPhone') ? 'smartphone' : 'laptop_mac'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-on-surface truncate">{log.device}</p>
                        <p className="text-[10px] text-on-surface-variant font-medium">{log.location} • {log.time}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <button className="w-full mt-8 py-3.5 rounded-xl bg-emerald-500 text-[#06201B] text-xs font-black uppercase tracking-widest shadow-md hover:bg-[#06201B] hover:text-emerald-400 hover:shadow-xl transition-all duration-300 active:scale-95 disabled:opacity-50" disabled={loginHistory.length === 0}>
                Sign Out All Devices
              </button>
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
