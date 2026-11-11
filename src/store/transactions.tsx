import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Transaction } from '@/lib/types';

const STORAGE_KEY = 'wallet/transactions/v1';

type TransactionsContextValue = {
  transactions: Transaction[];
  loaded: boolean;
  add: (data: Omit<Transaction, 'id'>) => void;
  update: (tx: Transaction) => void;
  remove: (id: string) => void;
};

const TransactionsContext = createContext<TransactionsContextValue | null>(null);

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TransactionsProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setTransactions(JSON.parse(raw) as Transaction[]);
      })
      .catch((error) => console.warn('No se pudieron cargar los movimientos', error))
      .finally(() => setLoaded(true));
  }, []);

  // Guarda cada cambio una vez cargados los datos (para no sobrescribir con la lista vacía inicial).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)).catch((error) =>
      console.warn('No se pudieron guardar los movimientos', error),
    );
  }, [transactions, loaded]);

  const add = useCallback((data: Omit<Transaction, 'id'>) => {
    setTransactions((list) => [{ ...data, id: newId() }, ...list]);
  }, []);

  const update = useCallback((tx: Transaction) => {
    setTransactions((list) => list.map((t) => (t.id === tx.id ? tx : t)));
  }, []);

  const remove = useCallback((id: string) => {
    setTransactions((list) => list.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(
    () => ({ transactions, loaded, add, update, remove }),
    [transactions, loaded, add, update, remove],
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

export function useTransactions(): TransactionsContextValue {
  const ctx = useContext(TransactionsContext);
  if (!ctx) throw new Error('useTransactions debe usarse dentro de TransactionsProvider');
  return ctx;
}
