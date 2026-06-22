import React, { useState, useEffect } from 'react';
import { useMerchantAuth } from '../../context/MerchantAuthContext';

export default function BiometricSetupModal() {
  const { merchant, isAuthenticated } = useMerchantAuth();
  const [showModal, setShowModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    // Only show if authenticated and hasn't explicitly skipped or completed setup
    const hasBiometrics = localStorage.getItem(`biometrics_enabled_${merchant?.email}`);
    const skippedSetup = localStorage.getItem(`biometrics_skipped_${merchant?.email}`);
    
    // Slight delay so it doesn't pop instantly on navigation
    if (isAuthenticated && !hasBiometrics && !skippedSetup) {
      const timer = setTimeout(() => setShowModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, merchant?.email]);

  const handleEnableBiometrics = async () => {
    setIsRegistering(true);
    try {
      // Check if WebAuthn is supported
      if (!window.PublicKeyCredential) {
        alert("Your device or browser doesn't support biometric authentication.");
        setIsRegistering(false);
        return;
      }

      // Generate a mock challenge
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);

      // This call physically triggers the OS-level Face ID / Touch ID hardware prompt
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: {
            name: "PayChain Financial Services",
            id: window.location.hostname
          },
          user: {
            id: userId,
            name: merchant?.email,
            displayName: merchant?.businessName || "Merchant"
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 }, // ES256
            { type: "public-key", alg: -257 } // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Forces built-in biometrics (Face ID/Touch ID)
            userVerification: "required"
          },
          timeout: 60000,
          attestation: "direct"
        }
      });

      if (credential) {
        // Success! Native OS verified the biometrics.
        setIsSuccess(true);
        // Save the credential ID locally to simulate backend registration for demo purposes
        const credentialIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        localStorage.setItem(`biometrics_enabled_${merchant?.email}`, credentialIdBase64);
        localStorage.setItem('last_biometric_user', merchant?.email);
        
        setTimeout(() => {
          setShowModal(false);
        }, 2000);
      }
    } catch (err) {
      console.error("Biometric registration failed:", err);
      // If user cancels the prompt, we don't show success
    } finally {
      if (!isSuccess) setIsRegistering(false);
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
