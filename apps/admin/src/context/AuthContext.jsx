import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

// Credentials provided by user for local/dev login
const ADMIN_EMAIL = 'administrator@paychain.co.ke';
const ADMIN_PW = 'Paychain.co.ke@2026';

export function AuthProvider({ children }){
  const [admin, setAdmin] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(()=>{
    const raw = localStorage.getItem('paychain_admin_session');
    if (raw){
      try{ setAdmin(JSON.parse(raw)); }catch(e){}
    }
    setIsLoading(false);
  },[]);

  async function login(email, password){
    // simulate API delay
    await new Promise(r=>setTimeout(r,1000));
    if (email === ADMIN_EMAIL && password === ADMIN_PW){
      const payload = { id: 'admin_001', name: 'PayChain Admin', email, role: 'super_admin' };
      setAdmin(payload);
      localStorage.setItem('paychain_admin_session', JSON.stringify(payload));
      return { success: true };
    }
    return { success: false, error: 'Invalid email or password' };
  }

  function logout(){
    localStorage.removeItem('paychain_admin_session');
    setAdmin(null);
    navigate('/login');
  }

  return (
    <AuthContext.Provider value={{ admin, isLoading, isAuthenticated: !!admin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(){
  return useContext(AuthContext);
}

export default AuthContext;

// TODO: Replace mock auth with real API
// POST /api/auth/login
// GET /api/auth/me
