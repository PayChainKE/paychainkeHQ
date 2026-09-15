import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import api from '../api/config';
import { excludeReversedDuplicates } from '../utils/transactionDirection';

// Single shared source for the merchant's transaction list — previously
// Dashboard, Transactions, and Collections each ran their own independent
// setInterval poll of the exact same GET /api/transactions endpoint (3s,
// 3s, and 5s respectively), all three running concurrently forever once a
// merchant had visited each tab, since tab screens stay mounted. That's the
// same full transaction history re-downloaded 3x every few seconds,
// including while the app sits backgrounded in someone's pocket — a real
// mobile-data cost with nothing to show for it. This context fetches once,
// polls once (slower, and only while the app is actually foregrounded), and
// every screen just reads from it.
//
// Screens that need "fresh right now" (opening the screen, pull-to-refresh)
// should call `refresh()` directly rather than waiting for the interval.
const POLL_INTERVAL_MS = 30 * 1000;

type TransactionsContextType = {
  transactions: any[];
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
};

const TransactionsContext = createContext<TransactionsContextType>({
  transactions: [],
  isLoading: true,
  isRefreshing: false,
  refresh: async () => {},
});

export function TransactionsProvider({ children }: { children: React.ReactNode }) {
  const { merchant } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const fetchTransactions = useCallback(async (isManualRefresh = false) => {
    if (!merchant) return;
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const res = await api.get('/api/transactions');
      const txList = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.transactions)
        ? res.data.transactions
        : [];
      // Applied once here instead of separately in every consuming screen
      // — see excludeReversedDuplicates' own doc comment.
      setTransactions(excludeReversedDuplicates(txList));
    } catch (error) {
      console.error('Error fetching transactions', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [merchant]);

  const refresh = useCallback(() => fetchTransactions(true), [fetchTransactions]);

  useEffect(() => {
    if (merchant) {
      setIsLoading(true);
      fetchTransactions();
    } else {
      setTransactions([]);
      setIsLoading(false);
    }
  }, [merchant, fetchTransactions]);

  // Poll only while the merchant is actually looking at the app — paused
  // entirely in the background instead of continuing to burn data for a
  // screen nobody can see. Picks up immediately (not waiting out a stale
  // interval tick) the moment the app returns to the foreground.
  useEffect(() => {
    if (!merchant) return undefined;

    let interval: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => fetchTransactions(), POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (!interval) return;
      clearInterval(interval);
      interval = null;
    };

    if (AppState.currentState === 'active') startPolling();

    const handleAppStateChange = (nextState: AppStateStatus) => {
      const wasActive = appStateRef.current === 'active';
      appStateRef.current = nextState;
      if (nextState === 'active' && !wasActive) {
        fetchTransactions();
        startPolling();
      } else if (nextState !== 'active') {
        stopPolling();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [merchant, fetchTransactions]);

  return (
    <TransactionsContext.Provider value={{ transactions, isLoading, isRefreshing, refresh }}>
      {children}
    </TransactionsContext.Provider>
  );
}

export function useTransactions() {
  return useContext(TransactionsContext);
}
