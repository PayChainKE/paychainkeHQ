import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Waitlist from './pages/Waitlist';
import Merchants from './pages/Merchants';
import Analytics from './pages/Analytics';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Team from './pages/Team';
import Ledger from './pages/Ledger';
import CashAdvanceRequests from './pages/CashAdvanceRequests';
import UserDashboard from './pages/UserDashboard';
import Newsletter from './pages/Newsletter';
import WalletAudit from './pages/WalletAudit';
import CallCentre from './pages/CallCentre';
import AuditLog from './pages/AuditLog';
import Revenue from './pages/Revenue';
import { UsersProvider } from './context/UsersContext';
import ToastHost from './components/ui/Toast';
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";

function Protected({ children }){
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="pc-spinner">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

export default function App(){
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <UsersProvider>
            <Routes>
            <Route path="/login" element={<Login/>} />
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Protected><Overview/></Protected>} />
            <Route path="/waitlist" element={<Protected><Waitlist/></Protected>} />
            <Route path="/newsletter" element={<Protected><Newsletter/></Protected>} />
              <Route path="/team" element={<Protected><Team/></Protected>} />
              <Route path="/team/:id/dashboard" element={<Protected><UserDashboard/></Protected>} />
            <Route path="/merchants" element={<Protected><Merchants/></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics/></Protected>} />
            <Route path="/messages" element={<Protected><Messages/></Protected>} />
            <Route path="/call-centre" element={<Protected><CallCentre/></Protected>} />
            <Route path="/cash-advance-requests" element={<Protected><CashAdvanceRequests/></Protected>} />
            <Route path="/ledger" element={<Protected><Ledger/></Protected>} />
            <Route path="/revenue" element={<Protected><Revenue/></Protected>} />
            <Route path="/wallet-audit" element={<Protected><WalletAudit/></Protected>} />
            <Route path="/audit-log" element={<Protected><AuditLog/></Protected>} />
            <Route path="/settings" element={<Protected><Settings/></Protected>} />
            </Routes>
          </UsersProvider>
          <ToastHost />
          <VercelAnalytics />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
