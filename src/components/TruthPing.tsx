import React, { useState, useEffect } from 'react';
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
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const messages = [
    {
      header: "PAYCHAINKE",
      content: "Confirmed. You have received KES 1,250.00 from Brandon Omutiti on 20/1/2026 at 14:32:05 Ref UAKJP46MS6. Status: Anchored | Blockchain ID: #789",
      footer: "This transaction is secured by PayChainKE."
    },
    {
      header: "PAYCHAINKE",
      content: "Confirmed. You have received KES 2,500.00 from Sarah Wanjiku on 20/1/2026 at 14:45:12 Ref MPX8N9K2L. Status: Anchored | Blockchain ID: #456",
      footer: "This transaction is secured by PayChainKE."
    },
    {
      header: "PAYCHAINKE",
      content: "Confirmed. You have received KES 750.00 from David Kiprop on 20/1/2026 at 15:02:33 Ref TXN7M4P9Q. Status: Anchored | Blockchain ID: #321",
      footer: "This transaction is secured by PayChainKE."
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
        setIsAnimating(false);
      }, 300);
    }, 8000); // Change message every 8 seconds

    return () => clearInterval(interval);
  }, []);

  const currentMessage = messages[currentMessageIndex];

  return (
    <div className={cn(
      "relative flex flex-col items-center justify-center p-8 transition-transform duration-100"
    )}>
      {/* Notification indicator removed */}

      {/* Main verification badge */}
      <img 
        src="/logo.png" 
        alt="PayChainKE Logo" 
        className="w-24 h-24 rounded-full object-cover"
      />

      {/* Status text */}
      <div className="mt-4 text-center px-2">
        <div className="space-y-3">
          {/* Main status */}
          <div className="flex items-center justify-center gap-2 text-base font-bold text-primary mb-4">
            VERIFIED: PAYMENT RECEIVED
          </div>
          
          {/* Transaction details - SMS style container with notification animation */}
          <div
            className={cn(
              "bg-white/95 text-gray-900 rounded-lg p-4 shadow-sm border border-gray-200 mx-auto max-w-xs transition-all duration-300",
              isAnimating
                ? "transform translate-y-2 opacity-0 scale-95"
                : "transform translate-y-0 opacity-100 scale-100"
            )}
          >
            <div className="text-xs leading-relaxed font-medium space-y-2">
              <p className="text-center font-bold text-green-600 mb-3">{currentMessage.header}</p>
              
              <p>
                {currentMessage.content}
              </p>
              
              <div className="border-t border-gray-300 pt-2 mt-3">
                <p className="text-center text-xs text-gray-600">
                  {currentMessage.footer}
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
