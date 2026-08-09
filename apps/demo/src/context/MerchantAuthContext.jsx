import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

  // Stage 1: password. Mirrors merchant-dashboard's real login exactly —
  // always returns mfaRequired:true (see loginMerchant in
  // merchantAuthController.js), never a token directly.
  async function realLogin(email, password) {
    try {
      const res = await api.post('/api/auth/merchant/login', { email, password })
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
      const { merchant: userData, token: jwt } = res.data
      api.defaults.headers.common['Authorization'] = `Bearer ${jwt}`
      setRealMerchant(userData)
      localStorage.setItem(REAL_STORAGE_KEY, JSON.stringify(userData))
      localStorage.setItem(REAL_TOKEN_KEY, jwt)
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

  async function login(phone, password){
    // simulate API delay
    await new Promise(r=>setTimeout(r,800))
    const norm = normalizePhone(phone)
    const saved = JSON.parse(localStorage.getItem(CRED_KEY) || JSON.stringify({phone:TEST_PHONE,password:TEST_TEMP_PW,first:true}))
    
    // If using the INITIAL DEMO CREDENTIALS, always trigger reset flow
    if (norm === TEST_PHONE && password === TEST_TEMP_PW) {
      setIsFirstLogin(true)
      return { success:true, firstLogin:true }
    }

    // If using SAVED CUSTOM CREDENTIALS, allow direct dashboard access
    if (norm === saved.phone && password === saved.password){
      setMerchant(mockMerchant)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockMerchant))
      setIsFirstLogin(false)
      return { success:true }
    }

    return { success:false, error:'Invalid phone number or password.' }
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
    localStorage.removeItem(STORAGE_KEY)
    setMerchant(null)
    navigate('/login')
  }

  return (
    <MerchantAuthContext.Provider value={{
      merchant, isLoading, isAuthenticated:!!merchant, isFirstLogin, login, setNewPassword, logout,
      // Real backend session (Stellar wallet / Inflation Shield pages only) —
      // see the block comment above REAL_STORAGE_KEY for why this is separate
      // from everything above.
      realMerchant, realLoading, refreshRealMerchant, realLogin, realVerifyOtp, realLogout,
    }}>
      {children}
    </MerchantAuthContext.Provider>
  )
}

export function useMerchantAuth(){ return useContext(MerchantAuthContext) }

export default MerchantAuthContext
