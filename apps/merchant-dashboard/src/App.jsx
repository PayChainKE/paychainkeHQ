import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MerchantAuthProvider, useMerchantAuth } from './context/MerchantAuthContext'
import { NotificationProvider } from './context/NotificationContext'
import ScrollToTop from './components/utils/ScrollToTop'
import Login from './pages/Login'
import SetupPassword from './pages/SetupPassword'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import BulkPay from './pages/BulkPay'
import InflationShield from './pages/InflationShield'
import CashAdvance from './pages/CashAdvance'
import TrustScore from './pages/TrustScore'
import Profile from './pages/Profile'
import Support from './pages/Support'
import Notifications from './pages/Notifications'
import MyTills from './pages/MyTills'
import Wallet from './pages/Wallet'
import SendMoney from './pages/SendMoney'
import RequestMoney from './pages/RequestMoney'
import PaymentPage from './pages/PaymentPage'
import ToastHost from './components/ui/Toast'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'
import useIdleTimer from './hooks/useIdleTimer'
import SessionTimeoutModal from './components/modals/SessionTimeoutModal'

// 40 minutes of on-tab inactivity → logout  |  warn 5 minutes before
const IDLE_TIMEOUT_MS  = 40 * 60 * 1000
const WARNING_BEFORE_MS =  5 * 60 * 1000

// Branded full-page loading spinner shown while session state is resolving
function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#FDFDFC] flex flex-col items-center justify-center z-50">
      <div className="relative w-16 h-16 mb-6">
        <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#00351D] animate-spin" />
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30">PayChain</p>
    </div>
  )
}

// Wraps every authenticated route. Enforces auth check and idle-timeout.
// The timer only counts time the user spends on THIS tab — switching tabs
// pauses the countdown; returning resets it.
function Protected({ children }) {
  const { isAuthenticated, isLoading, logout } = useMerchantAuth()
  const [showWarning, setShowWarning] = useState(false)

  useIdleTimer({
    timeout:   IDLE_TIMEOUT_MS,
    warningMs: WARNING_BEFORE_MS,
    enabled:   isAuthenticated,
    onWarn:    () => setShowWarning(true),
    onIdle:    () => { setShowWarning(false); logout() },
    onActive:  () => setShowWarning(false),
  })

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <>
      {children}
      {showWarning && (
        <SessionTimeoutModal
          countdownSec={WARNING_BEFORE_MS / 1000}
          onStay={() => setShowWarning(false)}
          onLogout={() => { setShowWarning(false); logout() }}
        />
      )}
    </>
  )
}

// Redirects already-authenticated users away from /login to the dashboard
function LoginGuard({ children }) {
  const { isAuthenticated, isLoading } = useMerchantAuth()
  if (isLoading) return <LoadingScreen />
  if (isAuthenticated) return <Navigate to="/overview" replace />
  return children
}

export default function App(){
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <MerchantAuthProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<LoginGuard><Login/></LoginGuard>} />
            <Route path="/setup-password" element={<SetupPassword/>} />
            <Route path="/pay/:linkId" element={<PaymentPage />} />
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Protected><Overview/></Protected>} />
            <Route path="/transactions" element={<Protected><Transactions/></Protected>} />
            <Route path="/bulk-pay" element={<Protected><BulkPay/></Protected>} />
            <Route path="/inflation-shield" element={<Protected><InflationShield/></Protected>} />
            <Route path="/cash-advance" element={<Protected><CashAdvance/></Protected>} />
            <Route path="/tills" element={<Protected><MyTills/></Protected>} />
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
        </NotificationProvider>
      </MerchantAuthProvider>
      <VercelAnalytics />
    </BrowserRouter>
  )
}
