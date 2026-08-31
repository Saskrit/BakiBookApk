import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { useMaintenance } from './MaintenanceContext';
import { useSocket, useSocketEvent } from './SocketContext';

const ALL_SCOPE = 'all';

type SyncContextValue = {
  getTick: (scope: string) => number;
};

const SyncContext = createContext<SyncContextValue>({
  getTick: () => 0,
});

type UserSyncPayload = {
  forceLogout?: boolean;
  deleted?: boolean;
  accountStatus?: string;
  reason?: string;
};

type DataInvalidatePayload = {
  scopes?: string[];
};

type MaintenancePayload = {
  maintenanceMode?: boolean;
  message?: string;
};

function RealtimeSyncBridge({ bump }: { bump: (scopes: string[]) => void }) {
  const { user, refreshUser, logout } = useAuth();
  const { enterMaintenance, clearMaintenance } = useMaintenance();
  const { connected } = useSocket();
  const prevConnected = useRef(false);
  const hadConnectedBefore = useRef(false);

  const onUserSync = useCallback(
    async (payload: UserSyncPayload) => {
      if (payload?.forceLogout || payload?.deleted) {
        await logout();
        return;
      }
      if (user) await refreshUser();
    },
    [logout, refreshUser, user]
  );

  const onDataInvalidate = useCallback(
    (payload: DataInvalidatePayload) => {
      const scopes = payload?.scopes?.length ? payload.scopes : [ALL_SCOPE];
      bump(scopes);
    },
    [bump]
  );

  const onMaintenance = useCallback(
    (payload: MaintenancePayload) => {
      if (payload?.maintenanceMode) {
        enterMaintenance(payload.message);
      } else {
        clearMaintenance();
      }
    },
    [clearMaintenance, enterMaintenance]
  );

  useSocketEvent<UserSyncPayload>('user:sync', onUserSync, Boolean(user));
  useSocketEvent<DataInvalidatePayload>('data:invalidate', onDataInvalidate, Boolean(user));
  useSocketEvent<MaintenancePayload>('maintenance:updated', onMaintenance, true);

  // After reconnect, refresh profile + lists in case events were missed offline.
  useEffect(() => {
    if (!user) {
      prevConnected.current = false;
      hadConnectedBefore.current = false;
      return;
    }
    if (connected && !prevConnected.current && hadConnectedBefore.current) {
      void refreshUser();
      bump([ALL_SCOPE]);
    }
    if (connected) hadConnectedBefore.current = true;
    prevConnected.current = connected;
  }, [connected, user, refreshUser, bump]);

  return null;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [ticks, setTicks] = useState<Record<string, number>>({});

  const bump = useCallback((scopes: string[]) => {
    setTicks((prev) => {
      const next = { ...prev };
      for (const scope of scopes) {
        next[scope] = (next[scope] || 0) + 1;
      }
      next[ALL_SCOPE] = (next[ALL_SCOPE] || 0) + 1;
      return next;
    });
  }, []);

  const getTick = useCallback((scope: string) => ticks[scope] ?? 0, [ticks]);

  const value = useMemo(() => ({ getTick }), [getTick]);

  return (
    <SyncContext.Provider value={value}>
      <RealtimeSyncBridge bump={bump} />
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}

/** Re-run `onInvalidate` when the server marks matching scopes stale. */
export function useSyncOnInvalidate(
  scopes: string[],
  onInvalidate: () => void | Promise<void>,
  enabled = true
) {
  const { getTick } = useSync();
  const scopeKey = scopes.join('|');
  const onInvalidateRef = useRef(onInvalidate);
  onInvalidateRef.current = onInvalidate;

  const signature = useMemo(() => {
    const normalized = [...new Set([...scopes, ALL_SCOPE])];
    return normalized.map((scope) => getTick(scope)).join(':');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scopeKey captures scopes content
  }, [getTick, scopeKey]);

  const isFirst = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    void onInvalidateRef.current();
  }, [signature, enabled]);
}
