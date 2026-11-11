import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { api, ApiError, type Connection, type ForwardingConfirmation } from '@/lib/api';
import { learnRule, type MerchantRules } from '@/lib/inbox';
import type { PendingItem, Transaction } from '@/lib/types';
import { useTransactions } from '@/store/transactions';

const KEYS = {
  connection: 'wallet/inbox/connection/v1',
  rules: 'wallet/inbox/merchant-rules/v1',
  handled: 'wallet/inbox/handled/v1',
};

type InboxContextValue = {
  connection: Connection | null;
  loaded: boolean;
  items: PendingItem[];
  forwardingConfirmation: ForwardingConfirmation | null;
  rules: MerchantRules;
  refreshing: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Guarda el movimiento en el teléfono y luego lo borra del servidor. */
  confirm: (item: PendingItem, data: Omit<Transaction, 'id'>) => void;
  discard: (item: PendingItem) => void;
  dismissConfirmation: () => Promise<void>;
};

const InboxContext = createContext<InboxContextValue | null>(null);

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'No se pudo conectar con el servidor. Revisa tu conexión.';
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const { add } = useTransactions();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [rules, setRules] = useState<MerchantRules>({});
  // IDs ya guardados o descartados en el teléfono. Si el aviso al servidor falla,
  // así no se vuelven a mostrar ni a importar; se reintenta el aviso en la siguiente sincronización.
  const [handled, setHandled] = useState<string[]>([]);
  const [serverItems, setServerItems] = useState<PendingItem[]>([]);
  const [forwardingConfirmation, setForwardingConfirmation] = useState<ForwardingConfirmation | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef<string[]>([]);
  handledRef.current = handled;

  useEffect(() => {
    AsyncStorage.multiGet([KEYS.connection, KEYS.rules, KEYS.handled])
      .then(([[, c], [, r], [, h]]) => {
        if (c) setConnection(JSON.parse(c));
        if (r) setRules(JSON.parse(r));
        if (h) setHandled(JSON.parse(h));
      })
      .catch((e) => console.warn('No se pudo cargar la bandeja', e))
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((key: string, value: unknown) => {
    const write = value === null ? AsyncStorage.removeItem(key) : AsyncStorage.setItem(key, JSON.stringify(value));
    return write.catch((e) => console.warn('No se pudo guardar', key, e));
  }, []);

  useEffect(() => {
    if (loaded) persist(KEYS.rules, rules);
  }, [rules, loaded, persist]);
  useEffect(() => {
    if (loaded) persist(KEYS.handled, handled);
  }, [handled, loaded, persist]);

  const refresh = useCallback(async () => {
    if (!connection) return;
    setRefreshing(true);
    try {
      const data = await api.inbox(connection.token);
      const done = new Set(handledRef.current);
      // Reintenta avisar al servidor de los que ya se procesaron aquí.
      const stale = data.items.filter((i) => done.has(i.id)).map((i) => i.id);
      if (stale.length) await api.ack(connection.token, stale).catch(() => undefined);
      // Olvida los IDs que el servidor ya no tiene.
      const onServer = new Set(data.items.map((i) => i.id));
      setHandled((list) => list.filter((id) => onServer.has(id)));
      setServerItems(data.items);
      setForwardingConfirmation(data.forwardingConfirmation);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [connection]);

  // Sincroniza al abrir la app y cada vez que vuelve a primer plano.
  useEffect(() => {
    if (!connection) return;
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [connection, refresh]);

  const connect = useCallback(async () => {
    try {
      const result = await api.register();
      setConnection(result);
      await persist(KEYS.connection, result);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    }
  }, [persist]);

  const disconnect = useCallback(async () => {
    setConnection(null);
    setServerItems([]);
    setForwardingConfirmation(null);
    setHandled([]);
    await persist(KEYS.connection, null);
  }, [persist]);

  const markHandled = useCallback(
    (item: PendingItem) => {
      setHandled((list) => (list.includes(item.id) ? list : [...list, item.id]));
      if (connection) api.ack(connection.token, [item.id]).catch(() => undefined);
    },
    [connection],
  );

  const confirm = useCallback(
    (item: PendingItem, data: Omit<Transaction, 'id'>) => {
      add({ ...data, source: 'email' });
      setRules((r) => learnRule(r, data.merchant, data.categoryId));
      markHandled(item);
    },
    [add, markHandled],
  );

  const discard = useCallback((item: PendingItem) => markHandled(item), [markHandled]);

  const dismissConfirmation = useCallback(async () => {
    setForwardingConfirmation(null);
    if (connection) await api.dismissConfirmation(connection.token).catch(() => undefined);
  }, [connection]);

  const items = useMemo(() => {
    const done = new Set(handled);
    return serverItems.filter((i) => !done.has(i.id));
  }, [serverItems, handled]);

  const value = useMemo(
    () => ({
      connection,
      loaded,
      items,
      forwardingConfirmation,
      rules,
      refreshing,
      error,
      connect,
      disconnect,
      refresh,
      confirm,
      discard,
      dismissConfirmation,
    }),
    [connection, loaded, items, forwardingConfirmation, rules, refreshing, error, connect, disconnect, refresh, confirm, discard, dismissConfirmation],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox debe usarse dentro de InboxProvider');
  return ctx;
}
