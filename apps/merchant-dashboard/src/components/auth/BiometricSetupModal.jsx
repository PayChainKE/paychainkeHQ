import React, { useState, useEffect } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { useMerchantAuth } from '../../context/MerchantAuthContext';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function BiometricSetupModal() {
  const { merchant, token, isAuthenticated, refreshSession } = useMerchantAuth();
  const [showModal, setShowModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Only show if authenticated, doesn't already have a real passkey, and
    // hasn't explicitly skipped setup on this device.
    const skippedSetup = localStorage.getItem(`biometrics_skipped_${merchant?.email}`);

    // Slight delay so it doesn't pop instantly on navigation
    if (isAuthenticated && merchant && !merchant.biometricsEnabled && !skippedSetup) {
      const timer = setTimeout(() => setShowModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, merchant]);

  const handleEnableBiometrics = async () => {
    setIsRegistering(true);
    setErrorMsg('');
    try {
      if (!window.PublicKeyCredential) {
        setErrorMsg("Your device or browser doesn't support biometric authentication.");
        setIsRegistering(false);
        return;
      }

      // 1 — Get a real registration challenge from the server
      const optRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/register-options`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const optData = await optRes.json();
      if (!optRes.ok) {
        setErrorMsg(optData.error || 'Failed to start passkey registration.');
        setIsRegistering(false);
        return;
      }

      // 2 — Trigger the OS-level Face ID / Touch ID hardware prompt
      const regResponse = await startRegistration({ optionsJSON: optData.options });

      // 3 — Verify and persist the credential on the server
      const verifyRes = await fetch(`${API_URL}/api/auth/merchant/webauthn/verify-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(regResponse),
      });
      const result = await verifyRes.json();

      if (!verifyRes.ok || !result.success) {
        setErrorMsg(result.error || 'Passkey registration failed.');
        setIsRegistering(false);
        return;
      }

      setIsSuccess(true);
      await refreshSession();

      setTimeout(() => {
        setShowModal(false);
      }, 2000);
    } catch (err) {
      // NotAllowedError = user cancelled the OS prompt — not a real error
      if (err?.name !== 'NotAllowedError') {
        setErrorMsg(err?.name === 'InvalidStateError'
          ? 'This device is already registered as a passkey.'
          : (err?.message || 'Biometric registration failed. Try again.'));
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`biometrics_skipped_${merchant?.email}`, 'true');
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#00351D]/60 backdrop-blur-md" onClick={handleSkip}></div>
      
      <div className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-[0_25px_70px_rgba(0,0,0,0.5)] border border-white/20 animate-in zoom-in-95 fade-in duration-300">
        
        <div className="flex flex-col items-center text-center">
          {/* Animated Icon */}
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            {isSuccess ? (
              <div className="absolute inset-0 bg-emerald-500 rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                <span className="material-symbols-outlined text-white text-4xl">check_circle</span>
              </div>
            ) : (
              <>
                <div className={`absolute inset-0 bg-emerald-500/10 rounded-full transition-transform duration-500 ${isRegistering ? 'scale-125 animate-pulse' : 'scale-100'}`}></div>
                <div className={`w-16 h-16 bg-[#00351D] rounded-full flex items-center justify-center text-[#5EFEB3] z-10 transition-transform duration-500 ${isRegistering ? 'scale-110' : 'scale-100'}`}>
                  <span className="material-symbols-outlined text-3xl">fingerprint</span>
                </div>
              </>
            )}
          </div>

          <h3 className="font-headline font-bold text-2xl text-primary mb-2">
            {isSuccess ? 'Biometrics Enabled' : 'Enable Biometrics'}
          </h3>
          <p className="text-sm text-on-surface-variant font-medium opacity-80 leading-relaxed mb-8">
            {isSuccess 
              ? 'You can now use Face ID or Touch ID to log in to your PayChain dashboard securely.' 
              : 'Sign in faster and more securely on this device using your fingerprint or Face ID.'}
          </p>

          {!isSuccess && (
            <div className="w-full space-y-3">
              {errorMsg && (
                <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl py-3 px-4">
                  {errorMsg}
                </p>
              )}
              <button
                onClick={handleEnableBiometrics}
                disabled={isRegistering}
                className="w-full bg-[#00351D] text-[#5EFEB3] py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-[#022916] transition-all disabled:opacity-70 disabled:scale-100 active:scale-95 flex items-center justify-center gap-2"
              >
                {isRegistering ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                    Waiting for OS...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-sm">fingerprint</span>
                    Set Up Now
                  </>
                )}
              </button>
              
              <button 
                onClick={handleSkip}
                disabled={isRegistering}
                className="w-full bg-transparent text-primary py-3 rounded-2xl font-bold text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all opacity-60 hover:opacity-100"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
