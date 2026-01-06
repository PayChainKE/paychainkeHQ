import React from 'react';
import { Check, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Transaction {
  id: string;
  amount: number;
  tillNumber: string;
  status: 'verified' | 'pending' | 'flagged';
  timestamp: string;
  hash?: string;
  phoneNumber?: string;
}

interface TransactionCardProps {
  transaction: Transaction;
}

const statusConfig = {
  verified: {
    icon: Check,
    label: 'Verified',
    bgClass: 'bg-success/10',
    textClass: 'text-success',
    borderClass: 'border-success/30',
  },
  pending: {
    icon: Clock,
    label: 'Pending',
    bgClass: 'bg-warning/10',
    textClass: 'text-warning',
    borderClass: 'border-warning/30',
  },
  flagged: {
    icon: AlertTriangle,
    label: 'Flagged',
    bgClass: 'bg-destructive/10',
    textClass: 'text-destructive',
    borderClass: 'border-destructive/30',
  },
};

const TransactionCard: React.FC<TransactionCardProps> = ({ transaction }) => {
  const config = statusConfig[transaction.status];
  const Icon = config.icon;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:border-primary/50 card-shadow",
      config.borderClass,
      "bg-card"
    )}>
      <div className="flex items-start justify-between gap-4">
        {/* Status icon */}
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg shrink-0",
          config.bgClass
        )}>
          <Icon className={cn("w-5 h-5", config.textClass)} />
        </div>

        {/* Transaction details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-bold text-foreground">
              KES {transaction.amount.toLocaleString()}
            </p>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-medium",
              config.bgClass,
              config.textClass
            )}>
              {config.label}
            </span>
          </div>
          
          <div className="mt-1 space-y-0.5">
            <p className="text-sm text-muted-foreground">
              Till: <span className="font-mono text-foreground">{transaction.tillNumber}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {transaction.timestamp}
            </p>
          </div>

          {/* Blockchain hash */}
          {transaction.hash && (
            <div className="mt-2 flex items-center gap-1.5 group cursor-pointer">
              <span className="text-xs text-muted-foreground font-mono truncate max-w-[180px]">
                {transaction.hash}
              </span>
              <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionCard;
