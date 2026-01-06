import React, { useState, useEffect } from 'react';
import { Check, Shield, Zap } from 'lucide-react';
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
  const [showPing, setShowPing] = useState(false);

  useEffect(() => {
    if (isVerified) {
      setShowPing(true);
      const timer = setTimeout(() => setShowPing(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isVerified]);

  return (
    <div className="relative flex flex-col items-center justify-center p-8">
      {/* Pulse rings */}
      {showPing && (
        <>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-primary/20 animate-pulse-ring" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center" style={{ animationDelay: '0.3s' }}>
            <div className="w-32 h-32 rounded-full bg-primary/15 animate-pulse-ring" style={{ animationDelay: '0.3s' }} />
          </div>
        </>
      )}

      {/* Main verification badge */}
      <div
        className={cn(
          "relative z-10 flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300",
          isVerified
            ? "bg-gradient-primary glow-primary animate-truth-ping"
            : "bg-muted"
        )}
      >
        {isVerified ? (
          <Check className="w-12 h-12 text-primary-foreground" strokeWidth={3} />
        ) : (
          <Shield className="w-10 h-10 text-muted-foreground" />
        )}
      </div>

      {/* Status text */}
      <div className="mt-6 text-center">
        <div className={cn(
          "flex items-center gap-2 text-lg font-bold",
          isVerified ? "text-primary" : "text-muted-foreground"
        )}>
          <Zap className="w-5 h-5" />
          {isVerified ? "VERIFIED" : "AWAITING PAYMENT"}
        </div>
        
        {isVerified && (
          <div className="mt-3 space-y-1 animate-fade-in">
            <p className="text-2xl font-bold text-foreground">
              KES {amount.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              Till: {tillNumber}
            </p>
            <p className="text-xs text-muted-foreground">
              {timestamp || new Date().toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TruthPing;
