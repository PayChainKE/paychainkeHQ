import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './SignIn';
import SignUp from './SignUp';
import ForgotPassword from './ForgotPassword';
import KYCWizard from './KYCWizard';

export default function AuthRouter() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/kyc/*" element={<KYCWizard />} />
      <Route path="/" element={<Navigate to="/signin" replace />} />
    </Routes>
  );
}
