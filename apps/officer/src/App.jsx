import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Queue from './pages/Queue';
import NewApplication from './pages/NewApplication';
import Workstation from './pages/Workstation';

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
        <Routes>
          <Route path="/login" element={<Login/>} />
          <Route path="/" element={<Navigate to="/queue" replace />} />
          <Route path="/queue" element={<Protected><Queue/></Protected>} />
          <Route path="/applications/new" element={<Protected><NewApplication/></Protected>} />
          <Route path="/applications/:id" element={<Protected><Workstation/></Protected>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
