import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MerchantAuthProvider, useMerchantAuth } from './context/MerchantAuthContext'
import { NotificationProvider } from './context/NotificationContext'
import ScrollToTop from './components/utils/ScrollToTop'
import AppErrorBoundary from './components/AppErrorBoundary'
import ToastHost from './components/ui/Toast'
import { Analytics as VercelAnalytics } from '@vercel/analytics/react'

// Route-level code splitting — every page used to be a static import here,
// meaning the full bundle (all 18 pages, including Transactions' jsPDF/
// jspdf-autotable, BulkPay's large batch-processing UI, etc.) downloaded
// and parsed before even the Login screen could render. Each page now
// loads its own chunk on first visit to that route instead of upfront.
const Login = lazy(() => import('./pages/Login'))
const SetupPassword = lazy(() => import('./pages/SetupPassword'))
const Overview = lazy(() => import('./pages/Overview'))
const Transactions = lazy(() => import('./pages/Transactions'))
const BulkPay = lazy(() => import('./pages/BulkPay'))
const Invoices = lazy(() => import('./pages/Invoices'))
const InflationShield = lazy(() => import('./pages/InflationShield'))
const CashAdvance = lazy(() => import('./pages/CashAdvance'))
const Profile = lazy(() => import('./pages/Profile'))
const Support = lazy(() => import('./pages/Support'))
const Notifications = lazy(() => import('./pages/Notifications'))
const MyAccounts = lazy(() => import('./pages/MyAccounts'))
const Wallet = lazy(() => import('./pages/Wallet'))
const SendMoney = lazy(() => import('./pages/SendMoney'))
const RequestMoney = lazy(() => import('./pages/RequestMoney'))
const PaymentPage = lazy(() => import('./pages/PaymentPage'))
const PayAccountPage = lazy(() => import('./pages/PayAccountPage'))
const InvoiceView = lazy(() => import('./pages/InvoiceView'))

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

function Protected({ children }) {
  const { isAuthenticated, isLoading } = useMerchantAuth()

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <Navigate to="/login" replace />

  return children
}

// Platform-wide kill switch — stablecoin/digital wallet features pulled
// for all merchants until further notice, regardless of each merchant's
// own `features` flag. Flip to an empty array to restore.
const STABLECOIN_FEATURES_DISABLED = ['digitalWallet', 'inflationShield']

function FeatureGuard({ featureName, children }) {
  const { merchant, isLoading } = useMerchantAuth()

  if (isLoading) return <LoadingScreen />
  if (STABLECOIN_FEATURES_DISABLED.includes(featureName)) {
    return <Navigate to="/overview" replace />
  }
  // If the feature object doesn't exist, we assume true for backward compatibility.
  // Otherwise we check if the flag is explicitly set to false.
  if (merchant?.features && merchant.features[featureName] === false) {
    return <Navigate to="/overview" replace />
  }

  return children
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
          <AppErrorBoundary>
            <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<LoginGuard><Login/></LoginGuard>} />
              <Route path="/setup-password" element={<SetupPassword/>} />
              <Route path="/pay/account/:account" element={<PayAccountPage />} />
              <Route path="/pay/:linkId" element={<PaymentPage />} />
              <Route path="/invoice/:publicToken" element={<InvoiceView />} />
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Protected><Overview/></Protected>} />
              <Route path="/transactions" element={<Protected><Transactions/></Protected>} />
              <Route path="/bulk-pay" element={<Protected><BulkPay/></Protected>} />
              <Route path="/invoices" element={<Protected><Invoices/></Protected>} />
              <Route path="/inflation-shield" element={<Protected><FeatureGuard featureName="inflationShield"><InflationShield/></FeatureGuard></Protected>} />
              <Route path="/cash-advance" element={<Protected><CashAdvance/></Protected>} />
              <Route path="/accounts" element={<Protected><MyAccounts/></Protected>} />
              {/* Old page URL — keep resolving so existing bookmarks/shared links don't break */}
              <Route path="/tills" element={<Navigate to="/accounts" replace />} />
              <Route path="/profile" element={<Protected><Profile/></Protected>} />
              <Route path="/support" element={<Protected><Support/></Protected>} />
              <Route path="/notifications" element={<Protected><Notifications/></Protected>} />
              <Route path="/wallet" element={<Protected><FeatureGuard featureName="digitalWallet"><Wallet/></FeatureGuard></Protected>} />
              {/* Send/Request Money are plain KES mobile-money features, unrelated to
                  the crypto/Stellar "digitalWallet" feature — they were previously
                  gated behind that same flag by mistake, silently breaking these
                  buttons for any merchant with digitalWallet disabled. */}
              <Route path="/send-money" element={<Protected><SendMoney/></Protected>} />
              <Route path="/request-money" element={<Protected><RequestMoney/></Protected>} />
              {/* Catch-all route for 404s and refreshes */}
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
            </Suspense>
          </AppErrorBoundary>
          <ToastHost />
        </NotificationProvider>
      </MerchantAuthProvider>
      <VercelAnalytics />
    </BrowserRouter>
  )
}
