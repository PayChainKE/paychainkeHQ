import React, { useState, useEffect, useCallback } from 'react'
import MerchantLayout from '../components/layout/MerchantLayout'
import { useToast } from '../context/NotificationContext'
import { usePrivacyMode } from '../hooks/usePrivacyMode'
import { useMerchantAuth } from '../context/MerchantAuthContext'
import { ValidatedInput } from '../components/ValidatedInput'
import { BiometricRegisterButton } from '../components/BiometricButton'
import axios from 'axios'

const DEFAULT_SECURITY_QUESTIONS = [
  "What is the name of the first school you attended?",
  "What is the name of your favorite musician or band?",
  "What was the make and model of your first car?"
]

function deviceLabel(platform, userAgent = '') {
  if (platform === 'mobile') return 'PayChain mobile app'
  const ua = (userAgent || '').toLowerCase()
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iPhone / iPad browser'
  if (ua.includes('android')) return 'Android browser'
  if (ua.includes('mac os')) return 'Mac browser'
  if (ua.includes('windows')) return 'Windows browser'
  return 'Web browser'
}

function deviceIcon(platform, userAgent = '') {
  if (platform === 'mobile') return 'smartphone'
  const ua = (userAgent || '').toLowerCase()
  if (ua.includes('iphone') || ua.includes('android')) return 'smartphone'
  if (ua.includes('ipad')) return 'tablet_mac'
  return 'laptop_mac'
}

function relativeTime(iso) {
  if (!iso) return ''
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  const days = Math.floor(seconds / 86400)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Profile() {
  const { showAmounts } = usePrivacyMode()
  const { merchant, logout, token } = useMerchantAuth()
  const [name, setName] = useState(merchant?.name || 'Admin')
  const [email, setEmail] = useState(merchant?.email || 'admin@paychain.ke')
  const [kraPin, setKraPin] = useState(merchant?.kraPin || '')
  const [businessNumber, setBusinessNumber] = useState(merchant?.businessNumber || '')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isUpdatingSecurity, setIsUpdatingSecurity] = useState(false)

  // PIN Reset states
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [isResettingPin, setIsResettingPin] = useState(false)

  // Security Questions states
  const [questionsConfig, setQuestionsConfig] = useState({ configured: false, count: 0, questions: DEFAULT_SECURITY_QUESTIONS })
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [questionAnswers, setQuestionAnswers] = useState(['', '', ''])
  const [questionsPassword, setQuestionsPassword] = useState('')
  const [showQuestionsPassword, setShowQuestionsPassword] = useState(false)
  const [isSavingQuestions, setIsSavingQuestions] = useState(false)

  const [kraPinLocked, setKraPinLocked] = useState(!!merchant?.kraPin)
  const [businessNumberLocked, setBusinessNumberLocked] = useState(!!merchant?.businessNumber)
  const toast = useToast()

  const fetchSecurityQuestions = useCallback(async () => {
    setIsLoadingQuestions(true)
    try {
      const token = localStorage.getItem('paychain_merchant_token')
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.get(`${API_URL}/api/auth/merchant/security-questions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) {
        setQuestionsConfig({
          configured: res.data.configured,
          count: res.data.count,
          questions: res.data.configured ? res.data.questions : DEFAULT_SECURITY_QUESTIONS,
        })
      }
    } catch (err) {
      // Non-fatal — fall back to the default question set already in state
    } finally {
      setIsLoadingQuestions(false)
    }
  }, [])

  useEffect(() => { fetchSecurityQuestions() }, [fetchSecurityQuestions])

  async function handleSecurityQuestionsSave() {
    if (questionAnswers.some((a) => !a.trim())) {
      toast.push({ message: 'Please answer all 3 security questions', type: 'error' })
      return
    }
    if (!questionsPassword) {
      toast.push({ message: 'Please confirm your current password', type: 'error' })
      return
    }

    setIsSavingQuestions(true)
    try {
      const token = localStorage.getItem('paychain_merchant_token')
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.put(`${API_URL}/api/auth/merchant/security-questions`, {
        questions: questionsConfig.questions.map((question, i) => ({ question, answer: questionAnswers[i] })),
        currentPassword: questionsPassword,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.data.success) {
        toast.push({ message: 'Security questions synchronized', type: 'success' })
        setShowQuestions(false)
        setQuestionAnswers(['', '', ''])
        setQuestionsPassword('')
        fetchSecurityQuestions()
      }
    } catch (err) {
      toast.push({ message: err.response?.data?.error || 'Failed to update security questions', type: 'error' })
    } finally {
      setIsSavingQuestions(false)
    }
  }

  function closeQuestions() {
    setShowQuestions(false)
    setQuestionAnswers(['', '', ''])
    setQuestionsPassword('')
  }

  // Active Sessions & Devices states (real registered passkeys/biometrics)
  const [passkeys, setPasskeys] = useState([])
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false)
  const [confirmRemoveId, setConfirmRemoveId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [confirmingSignOutAll, setConfirmingSignOutAll] = useState(false)
  const [isSigningOutAll, setIsSigningOutAll] = useState(false)

  const fetchPasskeys = useCallback(async () => {
    setIsLoadingPasskeys(true)
    try {
      const authToken = localStorage.getItem('paychain_merchant_token')
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.get(`${API_URL}/api/auth/merchant/webauthn/passkeys`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      if (res.data.success) {
        setPasskeys(res.data.passkeys)
      }
    } catch (err) {
      // Non-fatal — the card just shows its empty state
    } finally {
      setIsLoadingPasskeys(false)
    }
  }, [])

  useEffect(() => { fetchPasskeys() }, [fetchPasskeys])

  async function handleRemovePasskey(credentialID) {
    setRemovingId(credentialID)
    try {
      const authToken = localStorage.getItem('paychain_merchant_token')
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      await axios.delete(`${API_URL}/api/auth/merchant/webauthn/passkeys/${credentialID}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      })
      setPasskeys(prev => prev.filter(p => p.credentialID !== credentialID))
      toast.push({ message: 'Device removed.', type: 'success' })
    } catch (err) {
      toast.push({ message: err.response?.data?.error || 'Failed to remove device', type: 'error' })
    } finally {
      setRemovingId(null)
      setConfirmRemoveId(null)
    }
  }

  async function handleSignOutAllDevices() {
    setIsSigningOutAll(true)
    try {
      const token = localStorage.getItem('paychain_merchant_token')
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      await axios.post(`${API_URL}/api/auth/merchant/sign-out-all-devices`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.push({ message: "You've been signed out everywhere. Please sign in again.", type: 'success' })
      logout()
    } catch (err) {
      toast.push({ message: err.response?.data?.error || 'Failed to sign out all devices', type: 'error' })
      setIsSigningOutAll(false)
      setConfirmingSignOutAll(false)
    }
  }

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

  async function handlePinReset() {
    if (!currentPin || !newPin || !confirmNewPin) {
      toast.push({ message: 'Please fill out all PIN fields', type: 'error' })
      return
    }
    if (newPin !== confirmNewPin) {
      toast.push({ message: 'New PIN and confirm PIN do not match', type: 'error' })
      return
    }
    if (newPin.length !== 4) {
      toast.push({ message: 'New PIN must be exactly 4 digits', type: 'error' })
      return
    }

    setIsResettingPin(true)
    try {
      const token = localStorage.getItem('paychain_merchant_token');
      const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'
      const res = await axios.put(`${API_URL}/api/bulkpay/reset-pin`, {
        currentPin,
        newPin
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.status === 200) {
        toast.push({ message: 'Bulk Pay PIN updated successfully', type: 'success' })
        setCurrentPin('')
        setNewPin('')
        setConfirmNewPin('')
      }
    } catch (err) {
      toast.push({ message: err.response?.data?.message || 'Failed to reset PIN', type: 'error' })
    } finally {
      setIsResettingPin(false)
    }
  }

  return (
    <MerchantLayout title="Settings">
      <div className="px-1 lg:px-0 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-6 lg:mb-10">
          <h2 className="font-headline font-bold text-3xl lg:text-4xl text-primary tracking-tight">Settings</h2>
          <p className="text-on-surface-variant text-[11px] lg:text-sm font-medium mt-1.5 opacity-80">Manage your business profile, settlement rules, and security preferences.</p>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Main Settings Area — `contents` dissolves this wrapper on mobile so
              Profile/Security become independently orderable siblings of
              Merchant ID / Active Sessions below; `lg:block` restores the
              normal nested column at desktop, unchanged from before. */}
          <div className="contents lg:block lg:col-span-8 lg:space-y-8">

            {/* Section 1: Administrator Profile */}
            <div className="order-2 col-span-12 bg-white p-6 lg:p-10 rounded-[32px] lg:rounded-[40px] border border-slate-100 shadow-sm editorial-shadow animate-fade-in-up [animation-delay:100ms]">
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
                  <div className="flex justify-between items-center pr-1">
                    <label className="text-[9px] text-on-surface-variant font-black uppercase tracking-[0.2em] pl-1 opacity-50 group-hover:opacity-100 transition-opacity">KRA PIN</label>
                    {kraPinLocked && (
                      <button type="button" onClick={() => setKraPinLocked(false)} className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">edit</span> Edit
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <ValidatedInput
                      kind="kraPin"
                      value={kraPin}
                      onChange={(e) => setKraPin(e.target.value)}
                      placeholder="e.g. P123456789A"
                      disabled={kraPinLocked}
                      className={`w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none ${kraPinLocked ? 'opacity-60 bg-slate-50 cursor-not-allowed pr-32' : 'pr-32'}`}
                    />
                    {kraPinLocked && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary/40 pointer-events-none">
                        <span className="material-symbols-outlined text-sm">lock</span>
                      </div>
                    )}
                    {!kraPinLocked && merchant?.isKRAVerified && merchant?.kraPin === kraPin && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-1.5 rounded-lg border border-emerald-100 shadow-[0_2px_10px_rgba(16,185,129,0.1)] pointer-events-none">
                        <span className="material-symbols-outlined text-[14px]">verified_user</span>
                        <span className="text-[8px] font-black uppercase tracking-widest">eTIMS Verified</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 group">
                  <div className="flex justify-between items-center pr-1">
                    <label className="text-[9px] text-on-surface-variant font-black uppercase tracking-[0.2em] pl-1 opacity-50 group-hover:opacity-100 transition-opacity">Business / License Number</label>
                    {businessNumberLocked && (
                      <button type="button" onClick={() => setBusinessNumberLocked(false)} className="text-[9px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">edit</span> Edit
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <ValidatedInput
                      kind="businessReg"
                      optional
                      value={businessNumber}
                      onChange={(e) => setBusinessNumber(e.target.value)}
                      placeholder="e.g. PVT-XXXXXX"
                      disabled={businessNumberLocked}
                      className={`w-full bg-white border border-outline-variant/20 rounded-2xl px-5 py-3.5 text-sm font-bold text-primary focus:ring-0 focus:border-emerald-500/50 transition-all outline-none ${businessNumberLocked ? 'opacity-60 bg-slate-50 cursor-not-allowed pr-10' : ''}`}
                    />
                    {businessNumberLocked && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-primary/40 pointer-events-none">
                        <span className="material-symbols-outlined text-sm">lock</span>
                      </div>
                    )}
                  </div>
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
            <div className="order-3 col-span-12 bg-[#06201B] p-6 lg:p-10 rounded-[32px] lg:rounded-[40px] text-white shadow-2xl relative animate-fade-in-up [animation-delay:200ms]">
              
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

                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-10">
                  {/* Change Password Sub-section */}
                  <div className="space-y-6">
                    <h4 className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                       Change your password
                    </h4>
                    
                      <div className="space-y-2">
                        <label className="text-[9px] text-white/40 font-black uppercase tracking-widest pl-1">Current password</label>
                        <div className="relative">
                          <input
                            type={showCurrentPassword ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-5 pr-11 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-lg">{showCurrentPassword ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] text-white/40 font-black uppercase tracking-widest pl-1">New password</label>
                        <div className="relative">
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-5 pr-11 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-lg">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] text-white/40 font-black uppercase tracking-widest pl-1">Confirm new password</label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-5 pr-11 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1"
                          >
                            <span className="material-symbols-outlined text-lg">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                          </button>
                        </div>
                      </div>
                  </div>

                  {/* Advanced Auth Sub-section */}
                  <div className="space-y-8">
                    <div className="space-y-6">
                      <h4 className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Advanced Methods & Authorizations
                      </h4>
                      
                      {/* Bulk Pay PIN Reset */}
                      {merchant?.hasBulkPayPin && (
                        <div className="space-y-4 bg-white/5 p-5 rounded-[24px] border border-white/5">
                          <h5 className="text-xs font-black text-white">Reset Bulk Pay PIN</h5>
                          <div className="space-y-3">
                            <ValidatedInput
                              kind="pin4"
                              value={currentPin}
                              onChange={(e) => setCurrentPin(e.target.value)}
                              placeholder="Current PIN (4 digits)"
                              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-xs font-medium text-white focus:border-amber-500/50 outline-none transition-all placeholder:text-white/20"
                              errorClassName="text-red-300 text-[11px] font-bold mt-1.5 pl-1"
                            />
                            <div className="flex gap-3">
                              <ValidatedInput
                                kind="pin4"
                                value={newPin}
                                onChange={(e) => setNewPin(e.target.value)}
                                placeholder="New PIN"
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-xs font-medium text-white focus:border-amber-500/50 outline-none transition-all placeholder:text-white/20"
                                errorClassName="text-red-300 text-[11px] font-bold mt-1.5 pl-1"
                              />
                              <ValidatedInput
                                kind="pin4"
                                value={confirmNewPin}
                                onChange={(e) => setConfirmNewPin(e.target.value)}
                                placeholder="Confirm"
                                className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-xs font-medium text-white focus:border-amber-500/50 outline-none transition-all placeholder:text-white/20"
                                errorClassName="text-red-300 text-[11px] font-bold mt-1.5 pl-1"
                              />
                            </div>
                            <button 
                              onClick={handlePinReset}
                              disabled={isResettingPin || newPin.length !== 4}
                              className="w-full py-3 rounded-xl bg-amber-500 text-[#06201B] font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-amber-400 transition-all active:scale-95 disabled:opacity-50"
                            >
                              {isResettingPin ? 'Updating...' : 'Update PIN'}
                            </button>
                          </div>
                        </div>
                      )}

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
                            <p className="text-[10px] text-white/30 font-medium">
                              {isLoadingQuestions ? 'Loading…' : questionsConfig.configured ? `${questionsConfig.count} questions configured` : 'Not configured yet'}
                            </p>
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

                  {/* Trust / Protection Panel */}
                  <div className="lg:col-span-2 xl:col-span-1 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-transparent rounded-[28px] border border-emerald-500/10 p-7 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-400/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                    <div className="relative z-10">
                      <div className="inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest mb-6 border border-white/10">
                        <span className="material-symbols-outlined text-xs text-emerald-400">verified_user</span>
                        Bank-Grade Protection
                      </div>
                      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-400/25 to-emerald-600/10 flex items-center justify-center mb-6 border border-emerald-400/10">
                        <span className="material-symbols-outlined text-3xl text-emerald-400">encrypted</span>
                      </div>
                      <h4 className="font-headline text-lg text-white mb-2 leading-tight">Your account, fully shielded.</h4>
                      <p className="text-[11px] text-white/40 leading-relaxed mb-6">
                        Every credential you set here is encrypted at rest, never logged in plain text, and every change is recorded to your security audit trail.
                      </p>
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-emerald-400 text-base">lock</span>
                          <p className="text-[10px] text-white/50 font-medium">256-bit encrypted storage</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-emerald-400 text-base">history</span>
                          <p className="text-[10px] text-white/50 font-medium">Every change is audit-logged</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-emerald-400 text-base">support_agent</span>
                          <p className="text-[10px] text-white/50 font-medium">24/7 human security support</p>
                        </div>
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
                        onClick={closeQuestions}
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

                  {questionsConfig.configured && (
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 sm:p-5 rounded-2xl mb-6 lg:mb-8 shrink-0">
                      <p className="text-[11px] sm:text-xs text-amber-200/60 font-medium leading-relaxed">
                        You already have {questionsConfig.count} questions on file. Submitting below replaces all of them — for your security, previous answers are never shown back to you.
                      </p>
                    </div>
                  )}

                  <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                    {questionsConfig.questions.map((q, i) => (
                      <div key={i} className="space-y-3">
                        <label className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                          Question {i + 1}
                        </label>
                        <p className="text-sm font-black text-white px-1">{q}</p>
                        <input
                          type="text"
                          value={questionAnswers[i]}
                          onChange={(e) => setQuestionAnswers((prev) => prev.map((a, idx) => idx === i ? e.target.value : a))}
                          placeholder="Provide your answer"
                          disabled={isSavingQuestions}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 px-5 text-sm font-medium text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all placeholder:text-white/10 disabled:opacity-50"
                        />
                      </div>
                    ))}
                    <div className="space-y-3">
                      <label className="text-[10px] text-white/30 font-black uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                        Confirm your password
                      </label>
                      <div className="relative">
                        <input
                          type={showQuestionsPassword ? 'text' : 'password'}
                          value={questionsPassword}
                          onChange={(e) => setQuestionsPassword(e.target.value)}
                          placeholder="••••••••••••"
                          disabled={isSavingQuestions}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-5 pr-11 text-sm font-medium text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all placeholder:text-white/10 disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowQuestionsPassword(!showQuestionsPassword)}
                          disabled={isSavingQuestions}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors p-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-lg">{showQuestionsPassword ? 'visibility_off' : 'visibility'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 lg:mt-10 flex justify-end gap-3 sm:gap-4 shrink-0 border-t border-white/5 pt-6">
                    <button
                      onClick={closeQuestions}
                      disabled={isSavingQuestions}
                      className="px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white/40 hover:text-white transition-all underline decoration-emerald-500/20 underline-offset-8 disabled:opacity-50"
                    >
                      Go back
                    </button>
                    <button
                      onClick={handleSecurityQuestionsSave}
                      disabled={isSavingQuestions}
                      className="bg-emerald-500 text-[#06201B] px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl hover:bg-white transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSavingQuestions ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                          Saving...
                        </>
                      ) : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Area — same `contents` treatment; Merchant ID sits before
              Profile and Active Sessions sits after Security on mobile,
              while desktop keeps them stacked together in the right column. */}
          <div className="contents lg:block lg:col-span-4 lg:space-y-8">

            {/* Merchant ID Card */}
            <div className="order-1 col-span-12 bg-[#0A2540] p-8 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
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

            {/* Active Sessions & Devices */}
            <div className="order-4 col-span-12 bg-surface-container-lowest p-8 rounded-[32px] border border-outline-variant/10 shadow-sm editorial-shadow">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-lg">devices</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-lg text-primary leading-tight">Active Sessions &amp; Devices</h3>
                  <p className="text-[10px] text-on-surface-variant/60 font-medium">Biometric devices with access to your account</p>
                </div>
              </div>

              <div className="space-y-1 mt-6">
                {isLoadingPasskeys ? (
                  [...Array(2)].map((_, i) => (
                    <div key={i} className="flex items-center gap-4 py-3 animate-pulse">
                      <div className="w-9 h-9 rounded-xl bg-surface-container-low shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-3/4 bg-surface-container-low rounded" />
                        <div className="h-2 w-1/2 bg-surface-container-low rounded" />
                      </div>
                    </div>
                  ))
                ) : passkeys.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-low mx-auto flex items-center justify-center text-on-surface-variant/40 mb-3">
                      <span className="material-symbols-outlined text-xl">fingerprint</span>
                    </div>
                    <p className="text-[13px] text-on-surface font-bold">No devices registered yet</p>
                    <p className="text-[11px] text-on-surface-variant/60 font-medium mt-1 max-w-[220px] mx-auto leading-relaxed">
                      Add Face ID, Touch ID, or Windows Hello for faster, passwordless sign-in on this device.
                    </p>
                  </div>
                ) : (
                  // Reserve room for ~5 rows so the card holds its shape with
                  // just one or two real devices, then scroll past ~10 rather
                  // than growing the whole Settings page unbounded.
                  <div className="min-h-[280px] max-h-[560px] overflow-y-auto pr-1 -mr-1">
                    {passkeys.map((pk) => (
                      <div key={pk.credentialID} className="flex items-center gap-4 py-3.5 px-1.5 -mx-1.5 rounded-xl border-b border-outline-variant/5 last:border-0 hover:bg-surface-container-low/50 transition-colors group">
                        <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 text-primary/70">
                          <span className="material-symbols-outlined text-lg">{deviceIcon(pk.platform, pk.userAgent)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-on-surface leading-snug truncate">{deviceLabel(pk.platform, pk.userAgent)}</p>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-on-surface-variant/50 font-medium">
                            <span>Registered {relativeTime(pk.createdAt)}</span>
                            {pk.lastUsed && (
                              <>
                                <span>·</span>
                                <span>Last signed in {relativeTime(pk.lastUsed)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        {confirmRemoveId === pk.credentialID ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setConfirmRemoveId(null)}
                              disabled={removingId === pk.credentialID}
                              className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/60 hover:text-on-surface px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRemovePasskey(pk.credentialID)}
                              disabled={removingId === pk.credentialID}
                              className="text-[9px] font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {removingId === pk.credentialID ? (
                                <span className="material-symbols-outlined animate-spin text-[11px]">progress_activity</span>
                              ) : 'Remove'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemoveId(pk.credentialID)}
                            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant/30 hover:text-red-600 hover:bg-red-50 transition-colors"
                            aria-label={`Remove ${deviceLabel(pk.platform, pk.userAgent)}`}
                          >
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-outline-variant/10">
                <BiometricRegisterButton
                  token={token}
                  onSuccess={fetchPasskeys}
                  onError={(msg) => toast.push({ message: msg, type: 'error' })}
                />
              </div>

              {confirmingSignOutAll ? (
                <div className="mt-8 p-4 rounded-2xl bg-red-50 border border-red-100">
                  <p className="text-[11px] text-red-700 font-medium leading-relaxed mb-3">
                    This signs you out everywhere, including this browser. You'll need to log in again right after.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingSignOutAll(false)}
                      disabled={isSigningOutAll}
                      className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface text-[10px] font-black uppercase tracking-widest hover:bg-surface-container-low transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSignOutAllDevices}
                      disabled={isSigningOutAll}
                      className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-widest shadow-md hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isSigningOutAll ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                          Signing out…
                        </>
                      ) : 'Yes, sign out'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingSignOutAll(true)}
                  className="w-full mt-8 py-3.5 rounded-xl bg-emerald-500 text-[#06201B] text-xs font-black uppercase tracking-widest shadow-md hover:bg-[#06201B] hover:text-emerald-400 hover:shadow-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">phonelink_erase</span>
                  Sign Out All Devices
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </MerchantLayout>
  )
}
