import React, { createContext, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockMerchant } from '../mockData/merchant'

const MerchantAuthContext = createContext()

const STORAGE_KEY = 'paychain_merchant_session'
const CRED_KEY = 'paychain_merchant_creds'

// Initial test credentials (first-time temp password)
const TEST_PHONE = '+254712847291'
const TEST_TEMP_PW = 'TempPass2026!'

export function MerchantAuthProvider({ children }){
  const [merchant, setMerchant] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const navigate = useNavigate()

  useEffect(()=>{
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw){
      try{ setMerchant(JSON.parse(raw)); setIsFirstLogin(false) }catch(e){}
    }
    setIsLoading(false)
  },[])

  function normalizePhone(p){return p.replace(/\s|\+|-/g,'').replace(/^254/,'+254').replace(/^0/, '+254')}

  async function login(phone, password){
    // simulate API delay
    await new Promise(r=>setTimeout(r,800))
    const norm = normalizePhone(phone)
    // First time login - temp password
    const saved = JSON.parse(localStorage.getItem(CRED_KEY) || JSON.stringify({phone:TEST_PHONE,password:TEST_TEMP_PW,first:true}))
    if (norm === saved.phone && password === saved.password){
      if (saved.first){
        setIsFirstLogin(true)
        return { success:true, firstLogin:true }
      }
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
    const saved = JSON.parse(localStorage.getItem(CRED_KEY) || '{}')
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
    <MerchantAuthContext.Provider value={{ merchant, isLoading, isAuthenticated:!!merchant, isFirstLogin, login, setNewPassword, logout }}>
      {children}
    </MerchantAuthContext.Provider>
  )
}

export function useMerchantAuth(){ return useContext(MerchantAuthContext) }

export default MerchantAuthContext

// TODO: Replace mock auth with real API endpoints:
// POST /api/merchant/auth/login
// POST /api/merchant/auth/set-password
// GET /api/merchant/auth/me
