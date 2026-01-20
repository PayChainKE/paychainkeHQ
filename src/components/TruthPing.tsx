import React from 'react';
import { Check, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TruthPingProps {
  isVerified: boolean;
  amount?: number;
  tillNumber?: string;
  timestamp?: string;
  onAnimate?: () => void;
}

const TruthPing: React.FC<TruthPingProps> = ({
  isVerified,
  amount = 1500,
  tillNumber = "123456",
  timestamp,
}) => {

  return (
    <div className="relative flex flex-col items-center justify-center p-8">

      {/* Main verification badge */}
      <div className="relative z-10 flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary glow-primary">
        <Check className="w-12 h-12 text-primary-foreground" strokeWidth={3} />
      </div>

      {/* Status text */}
      <div className="mt-4 text-center px-2">
        <div className="space-y-3">
          {/* Main status */}
          <div className="flex items-center justify-center gap-2 text-base font-bold text-primary mb-4">
            <Check className="w-5 h-5" />
            VERIFIED: PAYMENT RECEIVED
          </div>
          
          {/* Transaction details - SMS style container */}
          <div className="bg-white/95 text-gray-900 rounded-lg p-4 shadow-sm border border-gray-200 mx-auto max-w-xs">
            <div className="text-xs leading-relaxed font-medium space-y-2">
              <p className="text-center font-bold text-green-600 mb-3">PAYCHAINKE</p>
              
              <p>
                Confirmed. You have received <span className="font-bold text-green-600">KES 1,250.00</span> from <span className="font-semibold">Brandon Omutiti</span> on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()} Ref <span className="font-mono bg-gray-100 px-1 rounded">UAKJP46MS6</span>.
              </p>
              
              <p>
                Status: <span className="font-semibold text-green-600">Anchored</span> | Blockchain ID: <span className="font-mono bg-gray-100 px-1 rounded text-green-600">#789</span>
              </p>
              
              <div className="border-t border-gray-300 pt-2 mt-3">
                <p className="text-center text-xs text-gray-600">
                  This transaction is secured by PayChainKE.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TruthPing;
