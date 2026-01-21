import { useState, useEffect } from 'react';

// Simulated transaction data
export interface Transaction {
  hash: string;
  amount: number;
  location: string;
  timestamp: number;
  status: 'pending' | 'anchored';
}

const kenyanLocations = [
  'Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret',
  'Thika', 'Malindi', 'Kitale', 'Garissa', 'Kakamega'
];

const generateTransaction = (): Transaction => ({
  hash: `0x${Math.random().toString(16).substr(2, 8)}...${Math.random().toString(16).substr(2, 4)}`,
  amount: Math.floor(Math.random() * 10000) + 100,
  location: kenyanLocations[Math.floor(Math.random() * kenyanLocations.length)],
  timestamp: Date.now(),
  status: 'pending'
});

export const useBaseScanner = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate connection
    setTimeout(() => setIsConnected(true), 1000);

    // Add new transactions periodically
    const interval = setInterval(() => {
      const newTx = generateTransaction();
      setTransactions(prev => [newTx, ...prev.slice(0, 9)]); // Keep last 10

      // Simulate anchoring after 2-5 seconds
      setTimeout(() => {
        setTransactions(prev =>
          prev.map(tx =>
            tx.hash === newTx.hash ? { ...tx, status: 'anchored' } : tx
          )
        );
      }, Math.random() * 3000 + 2000);
    }, 5000); // New tx every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return {
    transactions,
    isConnected,
    recentAnchors: transactions.filter(tx => tx.status === 'anchored').slice(0, 5)
  };
};