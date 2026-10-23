import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockMerchant } from '../mockData/merchant'
import api from '../api/config'

const MerchantAuthContext = createContext()

const STORAGE_KEY = 'paychain_merchant_session'
const CRED_KEY = 'paychain_merchant_creds'

// Initial test credentials (first-time temp password)
const TEST_PHONE = '+254712345678'
const TEST_TEMP_PW = 'Paychain2026'

// Everything above/below tied to STORAGE_KEY/CRED_KEY is a self-contained
// visual demo of the general PayChain product (mock login, mock balances,
// mock trust score, etc.) and is deliberately left untouched — rewiring it
// to a real backend would risk breaking the whole pitch-deck-style
// walkthrough for no benefit. The Stellar wallet + Inflation Shield pages
// are the one place that needs to be genuinely real (for the grant
// deliverable's verifiable on-chain evidence), so a SEPARATE, real backend
// session is layered in below — `realMerchant`/`realLogin`/`realVerifyOtp`,
// additive only, nothing else in this app reads from it. This can't be a
// silent background login: every merchant login requires OTP verification
// (no bypass, by design — see merchantAuthController.js), so whoever is
// producing the demo/evidence logs in for real, once, on the Wallet or
// Inflation Shield page; the resulting token is valid 30 days and persisted
// separately below so it survives reloads without repeating that OTP step
// constantly.
const REAL_STORAGE_KEY = 'paychain_demo_real_merchant'
const REAL_TOKEN_KEY = 'paychain_demo_real_token'

export function MerchantAuthProvider({ children }){
  const [merchant, setMerchant] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const navigate = useNavigate()

  const [realMerchant, setRealMerchant] = useState(null)
  const [realLoading, setRealLoading] = useState(true)

  const refreshRealMerchant = useCallback(async () => {
    try {
      const res = await api.get('/api/auth/merchant/me')
      if (res.data?.success && res.data.merchant) {
        setRealMerchant(res.data.merchant)
        localStorage.setItem(REAL_STORAGE_KEY, JSON.stringify(res.data.merchant))
        return res.data.merchant
      }
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem(REAL_STORAGE_KEY)
        localStorage.removeItem(REAL_TOKEN_KEY)
        setRealMerchant(null)
      }
      console.error('Failed to refresh real demo merchant session', err)
    }
    return null
  }, [])

  // Shared by both places a real session actually gets established below —
  // OTP verification, and login itself when the backend skips OTP (demo/
  // pilot accounts; see loginMerchant's isDemoMerchant bypass).
  function establishSession(userData, jwt) {
    api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`
    setRealMerchant(userData)
    localStorage.setItem(REAL_STORAGE_KEY, JSON.stringify(userData))
    localStorage.setItem(REAL_TOKEN_KEY, jwt)
  }

  // Stage 1: password. For a real merchant this always returns
  // mfaRequired:true (see loginMerchant in merchantAuthController.js),
  // never a token directly — proceed to realVerifyOtp. Demo/pilot accounts
  // are the one exception: the backend skips OTP for them entirely and
  // returns a completed session right here, so `completed: true` tells the
  // caller to skip the OTP stage rather than wait for a code that was
  // never sent.
  async function realLogin(email, password) {
    try {
      const res = await api.post('/api/auth/merchant/login', { email, password })
      if (res.data?.mfaRequired === false && res.data?.token) {
        establishSession(res.data.merchant, res.data.token)
        return { success: true, completed: true }
      }
      return { success: true, mfaRequired: res.data?.mfaRequired, channel: res.data?.channel, maskedPhone: res.data?.maskedPhone }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' }
    }
  }

  // Stage 2: OTP. On success, stores the real 30-day token and merchant —
  // this is what actually establishes the real session.
  async function realVerifyOtp(email, otp) {
    try {
      const res = await api.post('/api/auth/merchant/verify-otp', { email, otp })
      establishSession(res.data.merchant, res.data.token)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Invalid or expired code' }
    }
  }

  function realLogout() {
    localStorage.removeItem(REAL_STORAGE_KEY)
    localStorage.removeItem(REAL_TOKEN_KEY)
    delete api.defaults.headers.common['Authorization']
    setRealMerchant(null)
  }

  // Forgot-password, 3 steps — mirrors merchant-dashboard/src/pages/Login.jsx's
  // own forgotPassword/verifyResetOTP/resetPassword exactly (same endpoints,
  // same shapes), for whoever is producing the grant evidence and has lost
  // the shared demo-merchant password. Additive, same as realLogin/
  // realVerifyOtp above — nothing else in this app touches these.
  async function realForgotPassword(identifier) {
    try {
      const res = await api.post('/api/auth/merchant/forgot-password', { email: identifier })
      return { success: true, maskedEmail: res.data?.maskedEmail, maskedPhone: res.data?.maskedPhone }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Could not start password reset.' }
    }
  }

  async function realVerifyResetOtp(identifier, otp) {
    try {
      const res = await api.post('/api/auth/merchant/verify-reset-otp', { email: identifier, otp })
      return { success: true, resetToken: res.data?.resetToken }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Invalid or expired code.' }
    }
  }

  async function realResetPassword(resetToken, newPassword) {
    try {
      await api.post('/api/auth/merchant/reset-password', { resetToken, newPassword })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Could not reset password.' }
    }
  }

  useEffect(()=>{
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw){
      try{ setMerchant(JSON.parse(raw)); setIsFirstLogin(false) }catch(e){}
    }

    // Reset stale credentials if they don't match the new demo defaults
    const saved = localStorage.getItem(CRED_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.phone !== TEST_PHONE && parsed.phone === '+254712847291') {
          localStorage.removeItem(CRED_KEY)
        }
      } catch (e) {}
    }

    setIsLoading(false)

    // Restore the real session, if one was already established.
    const rawRealMerchant = localStorage.getItem(REAL_STORAGE_KEY)
    const rawRealToken = localStorage.getItem(REAL_TOKEN_KEY)
    if (rawRealMerchant && rawRealToken) {
      try {
        setRealMerchant(JSON.parse(rawRealMerchant))
        api.defaults.headers.common['Authorization'] = `Bearer ${rawRealToken}`
        refreshRealMerchant().finally(() => setRealLoading(false))
        return
      } catch (e) {}
    }
    setRealLoading(false)
  },[])

  function normalizePhone(p){return p.replace(/\s|\+|-/g,'').replace(/^254/,'+254').replace(/^0/, '+254')}

  function enterDemoDashboard(){
    setMerchant(mockMerchant)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockMerchant))
    setIsFirstLogin(false)
  }

  // Sign in with a phone number OR an email. The demo test credentials
  // (phone or the demo email) keep the mock walkthrough; anything else is
  // tried against the real backend, which accepts either identifier — so
  // pilot merchants can sign in here with their own credentials, and the
  // real Stellar session is established at the same time.
  async function login(identifier, password){
    const id = String(identifier || '').trim()
    const isEmail = id.includes('@')
    const saved = JSON.parse(localStorage.getItem(CRED_KEY) || JSON.stringify({phone:TEST_PHONE,password:TEST_TEMP_PW,first:true}))
    const isDemoId = isEmail
      ? id.toLowerCase() === mockMerchant.email.toLowerCase()
      : normalizePhone(id) === TEST_PHONE || normalizePhone(id) === saved.phone

    if (isDemoId) {
      // simulate API delay
      await new Promise(r=>setTimeout(r,800))
      // If using the INITIAL DEMO CREDENTIALS, always trigger reset flow
      if (password === TEST_TEMP_PW) {
        setIsFirstLogin(true)
        return { success:true, firstLogin:true }
      }
      // If using SAVED CUSTOM CREDENTIALS, allow direct dashboard access
      if (password === saved.password){
        realLogout()
        enterDemoDashboard()
        return { success:true }
      }
      return { success:false, error:'Invalid phone number, email or password.' }
    }

    const res = await realLogin(id, password)
    if (!res.success) return { success:false, error: res.error || 'Invalid phone number, email or password.' }
    if (res.completed) {
      enterDemoDashboard()
      return { success:true }
    }
    return { success:true, otpRequired:true, maskedPhone: res.maskedPhone }
  }

  // Second step of a real sign-in that needed an OTP.
  async function verifyLoginOtp(identifier, otp){
    const res = await realVerifyOtp(String(identifier || '').trim(), otp)
    if (res.success) enterDemoDashboard()
    return res
  }

  async function setNewPassword(newPassword){
    await new Promise(r=>setTimeout(r,800))
    // persist mock credential change
    const saved = JSON.parse(localStorage.getItem(CRED_KEY) || JSON.stringify({phone:TEST_PHONE,password:TEST_TEMP_PW,first:true}))
    saved.password = newPassword
    saved.first = false
    localStorage.setItem(CRED_KEY, JSON.stringify(saved))
    setMerchant(mockMerchant)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mockMerchant))
    setIsFirstLogin(false)
    return { success:true }
  }

  function logout(){
    realLogout()
    localStorage.removeItem(STORAGE_KEY)
    setMerchant(null)
    navigate('/login')
  }

  // What the dashboard shows as "the merchant": the signed-in real account's
  // identity and balances when there is one, layered over the sample
  // profile (which still supplies the walkthrough's charts, trust score,
  // advances, etc.). Demo credentials alone show the sample profile.
  const displayMerchant = useMemo(() => {
    if (!realMerchant) return mockMerchant
    const r = realMerchant
    return {
      ...mockMerchant,
      name: r.name || r.businessName || mockMerchant.name,
      businessName: r.businessName || r.name || mockMerchant.businessName,
      email: r.email || '',
      phone: r.phone || '',
      virtualAccountNumber: r.ncbaMerchantCode || r.ncbaVirtualAccountNumber || mockMerchant.virtualAccountNumber,
      createdAt: r.createdAt || null,
      lastLogin: r.lastLogin || null,
      financials: {
        ...mockMerchant.financials,
        kesBalance: Number(r.kesBalance ?? 0),
        usdcBalance: Number(r.usdcBalance ?? 0),
      },
    }
  }, [realMerchant])

  return (
    <MerchantAuthContext.Provider value={{
      displayMerchant,
      merchant, isLoading, isAuthenticated:!!merchant, isFirstLogin, login, verifyLoginOtp, setNewPassword, logout,
      // Real backend session (Stellar wallet / Inflation Shield pages only) —
      // see the block comment above REAL_STORAGE_KEY for why this is separate
      // from everything above.
      realMerchant, realLoading, refreshRealMerchant, realLogin, realVerifyOtp, realLogout,
      realForgotPassword, realVerifyResetOtp, realResetPassword,
    }}>
      {children}
    </MerchantAuthContext.Provider>
  )
}

export function useMerchantAuth(){ return useContext(MerchantAuthContext) }
export function useDisplayMerchant(){ return useContext(MerchantAuthContext).displayMerchant }

export default MerchantAuthContext
