import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Login(){
  const { login } = useAuth();
  const [email, setEmail] = useState('administrator@paychain.co.ke');
  const [password, setPassword] = useState('Paychain.co.ke@2026');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function onSubmit(e){
    e.preventDefault(); setLoading(true); setError('');
    const res = await login(email, password);
    setLoading(false);
    if (res.success){ navigate('/overview'); }
    else setError(res.error || 'Login failed');
  }

  return (
    <div className="pc-login">
      <div className="pc-login-left">
        <h1>PayChain</h1>
        <p className="pc-tagline">Kenya's Merchant Operating System.</p>
        <div className="pc-features">
          <div>• Waitlist management & approvals</div>
          <div>• Live merchant monitoring</div>
          <div>• Analytics & growth tracking</div>
        </div>
      </div>
      <div className="pc-login-right">
        <form className={`pc-login-form ${error? 'shake':''}`} onSubmit={onSubmit}>
          <h2>Welcome back</h2>
          <p className="pc-sub">Sign in to the PayChain admin portal.</p>
          <label>Email address
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@paychain.co.ke" autoComplete="email" />
          </label>
          <label>Password
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
          </label>
          {error && <div className="pc-error">{error}</div>}
          <button className="pc-btn" type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
          <div className="pc-hint">PayChain · Authorized Personnel Only</div>
        </form>
      </div>
    </div>
  );
}
