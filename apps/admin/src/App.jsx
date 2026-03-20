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
import ToastHost from './components/ui/Toast';

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
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Protected><Overview/></Protected>} />
            <Route path="/waitlist" element={<Protected><Waitlist/></Protected>} />
            <Route path="/merchants" element={<Protected><Merchants/></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics/></Protected>} />
            <Route path="/messages" element={<Protected><Messages/></Protected>} />
            <Route path="/settings" element={<Protected><Settings/></Protected>} />
          </Routes>
          <ToastHost />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
