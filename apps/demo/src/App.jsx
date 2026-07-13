import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MerchantAuthProvider, useMerchantAuth } from './context/MerchantAuthContext'
import { NotificationProvider } from './context/NotificationContext'
import ScrollToTop from './components/utils/ScrollToTop'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import BulkPay from './pages/BulkPay'
import InflationShield from './pages/InflationShield'
import CashAdvance from './pages/CashAdvance'
import TrustScore from './pages/TrustScore'
import Profile from './pages/Profile'
import Support from './pages/Support'
import Notifications from './pages/Notifications'
import MyAccounts from './pages/MyAccounts'
import Wallet from './pages/Wallet'
import SendMoney from './pages/SendMoney'
import RequestMoney from './pages/RequestMoney'
import ToastHost from './components/ui/Toast'
import { Analytics } from "@vercel/analytics/react"

function Protected({ children }){
  const { isAuthenticated, isLoading, isFirstLogin } = useMerchantAuth()
  if (isLoading) return <div style={{padding:40}}>Loading...</div>
  if (!isAuthenticated && !isFirstLogin) return <Navigate to="/login" />
  if (isFirstLogin) return <Navigate to="/set-password" />
  return children
}

export default function App(){
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <MerchantAuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login/>} />
            <Route path="/set-password" element={<SetPassword/>} />
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Protected><Overview/></Protected>} />
            <Route path="/transactions" element={<Protected><Transactions/></Protected>} />
            <Route path="/bulk-pay" element={<Protected><BulkPay/></Protected>} />
            <Route path="/inflation-shield" element={<Protected><InflationShield/></Protected>} />
            <Route path="/cash-advance" element={<Protected><CashAdvance/></Protected>} />
            <Route path="/accounts" element={<Protected><MyAccounts/></Protected>} />
            <Route path="/trust-score" element={<Protected><TrustScore/></Protected>} />
            <Route path="/profile" element={<Protected><Profile/></Protected>} />
            <Route path="/support" element={<Protected><Support/></Protected>} />
            <Route path="/notifications" element={<Protected><Notifications/></Protected>} />
            <Route path="/wallet" element={<Protected><Wallet/></Protected>} />
            <Route path="/send-money" element={<Protected><SendMoney/></Protected>} />
            <Route path="/request-money" element={<Protected><RequestMoney/></Protected>} />
            {/* Catch-all route for 404s and refreshes */}
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
          <ToastHost />
          <Analytics />
        </NotificationProvider>
      </MerchantAuthProvider>
    </BrowserRouter>
  )
}
