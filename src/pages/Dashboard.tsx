import React, { useState, useEffect } from 'react';
import { Shield, Zap, AlertTriangle, TrendingUp, Activity, DollarSign } from 'lucide-react';
import Navbar from '@/components/Navbar';
import TruthPing from '@/components/TruthPing';
import TransactionCard, { Transaction } from '@/components/TransactionCard';
import StatsCard from '@/components/StatsCard';

const mockTransactions: Transaction[] = [
  {
    id: '1',
    amount: 2500,
    tillNumber: '174379',
    status: 'verified',
    timestamp: '14:32:05',
    hash: '0x7f2c...a3b1',
    phoneNumber: '+254712***890',
  },
  {
    id: '2',
    amount: 8750,
    tillNumber: '174379',
    status: 'verified',
    timestamp: '14:28:41',
    hash: '0x9a4d...c2f8',
    phoneNumber: '+254733***456',
  },
  {
    id: '3',
    amount: 150,
    tillNumber: '174379',
    status: 'flagged',
    timestamp: '14:25:12',
    phoneNumber: '+254700***123',
  },
  {
    id: '4',
    amount: 3200,
    tillNumber: '174379',
    status: 'pending',
    timestamp: '14:24:55',
    phoneNumber: '+254722***789',
  },
  {
    id: '5',
    amount: 1800,
    tillNumber: '174379',
    status: 'verified',
    timestamp: '14:20:33',
    hash: '0x3e7b...d5a2',
    phoneNumber: '+254711***234',
  },
];

const Dashboard: React.FC = () => {
  const [isVerified, setIsVerified] = useState(false);
  const [transactions, setTransactions] = useState(mockTransactions);
  const [latestAmount, setLatestAmount] = useState(2500);

  useEffect(() => {
    // Simulate incoming transactions
    const interval = setInterval(() => {
      const amounts = [500, 1200, 2500, 3800, 5000, 7500];
      const newAmount = amounts[Math.floor(Math.random() * amounts.length)];
      setLatestAmount(newAmount);
      setIsVerified(true);
      
      // Add new transaction to list
      const newTx: Transaction = {
        id: Date.now().toString(),
        amount: newAmount,
        tillNumber: '174379',
        status: 'verified',
        timestamp: new Date().toLocaleTimeString(),
        hash: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
        phoneNumber: `+254${Math.floor(Math.random() * 900000000 + 100000000).toString().replace(/(\d{3})(\d{3})(\d{3})/, '$1***$3')}`,
      };
      
      setTransactions(prev => [newTx, ...prev.slice(0, 4)]);
      
      setTimeout(() => setIsVerified(false), 3000);
    }, 8000);

    // Initial verification
    const timeout = setTimeout(() => setIsVerified(true), 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Merchant Dashboard</h1>
          <p className="text-muted-foreground">Till Number: 174379 • Eastleigh Branch</p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="Today's Volume"
            value="KES 285,400"
            subtitle="127 transactions"
            icon={DollarSign}
            trend={{ value: 12.5, isPositive: true }}
            variant="primary"
          />
          <StatsCard
            title="Verified"
            value="124"
            subtitle="97.6% success rate"
            icon={Shield}
            variant="success"
          />
          <StatsCard
            title="Flagged"
            value="3"
            subtitle="Potential fraud attempts"
            icon={AlertTriangle}
            variant="warning"
          />
          <StatsCard
            title="Avg. Latency"
            value="47ms"
            subtitle="Verification speed"
            icon={Zap}
            variant="default"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Truth Ping Panel */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-border bg-card p-6 card-shadow">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Live Truth Ping</h2>
              </div>
              
              <TruthPing 
                isVerified={isVerified} 
                amount={latestAmount}
                tillNumber="174379"
              />

              <div className="mt-6 p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-xs text-muted-foreground text-center">
                  🔗 Connected to Base L2 • Block #18,234,567
                </p>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-border bg-card p-6 card-shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Recent Transactions</h2>
                </div>
                <span className="text-xs text-muted-foreground">Auto-updating</span>
              </div>

              <div className="space-y-3">
                {transactions.map((tx) => (
                  <TransactionCard key={tx.id} transaction={tx} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
