import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Login from './pages/Login';
import SetupPassword from './pages/SetupPassword';
import Overview from './pages/Overview';
import Waitlist from './pages/Waitlist';
import Merchants from './pages/Merchants';
import Analytics from './pages/Analytics';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Team from './pages/Team';
import Officers from './pages/Officers';
import Developers from './pages/Developers';
import Ledger from './pages/Ledger';
import StkMonitor from './pages/StkMonitor';
import CashAdvanceRequests from './pages/CashAdvanceRequests';
import Newsletter from './pages/Newsletter';
import WalletAudit from './pages/WalletAudit';
import Invoices from './pages/Invoices';
import CallCentre from './pages/CallCentre';
import AuditLog from './pages/AuditLog';
import TransactionAudit from './pages/TransactionAudit';
import Security from './pages/Security';
import Revenue from './pages/Revenue';
import PoolReconciliation from './pages/PoolReconciliation';
import Bookkeeping from './pages/Bookkeeping';
import TaxCompliance from './pages/TaxCompliance';
import SmsBroadcast from './pages/SmsBroadcast';
import KycVerification from './pages/KycVerification';
import KycApplicationDetail from './pages/KycApplicationDetail';
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
          <Routes>
            <Route path="/login" element={<Login/>} />
            <Route path="/setup-password" element={<SetupPassword/>} />
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Protected><Overview/></Protected>} />
            <Route path="/waitlist" element={<Protected><Waitlist/></Protected>} />
            <Route path="/newsletter" element={<Protected><Newsletter/></Protected>} />
            <Route path="/sms-broadcast" element={<Protected><SmsBroadcast/></Protected>} />
            <Route path="/team" element={<Protected><Team/></Protected>} />
            <Route path="/officers" element={<Protected><Officers/></Protected>} />
            <Route path="/developers" element={<Protected><Developers/></Protected>} />
            <Route path="/merchants" element={<Protected><Merchants/></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics/></Protected>} />
            <Route path="/messages" element={<Protected><Messages/></Protected>} />
            <Route path="/call-centre" element={<Protected><CallCentre/></Protected>} />
            <Route path="/cash-advance-requests" element={<Protected><CashAdvanceRequests/></Protected>} />
            <Route path="/ledger" element={<Protected><Ledger/></Protected>} />
            <Route path="/stk-monitor" element={<Protected><StkMonitor/></Protected>} />
            <Route path="/revenue" element={<Protected><Revenue/></Protected>} />
            <Route path="/pool-reconciliation" element={<Protected><PoolReconciliation/></Protected>} />
            <Route path="/kyc-verification" element={<Protected><KycVerification/></Protected>} />
            <Route path="/kyc-verification/:id" element={<Protected><KycApplicationDetail/></Protected>} />
            <Route path="/bookkeeping" element={<Protected><Bookkeeping/></Protected>} />
            <Route path="/tax-compliance" element={<Protected><TaxCompliance/></Protected>} />
            <Route path="/wallet-audit" element={<Protected><WalletAudit/></Protected>} />
            <Route path="/invoices" element={<Protected><Invoices/></Protected>} />
            <Route path="/audit-log" element={<Protected><AuditLog/></Protected>} />
            <Route path="/transaction-audit" element={<Protected><TransactionAudit/></Protected>} />
            <Route path="/security" element={<Protected><Security/></Protected>} />
            <Route path="/settings" element={<Protected><Settings/></Protected>} />
          </Routes>
          <ToastHost />
          <VercelAnalytics />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
