import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { getAuthToken, getActiveApiBaseUrl } from '../api/client';
import { getSocketOrigin } from '../config/api';
import { useAuth } from './AuthContext';

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const disconnect = useCallback(() => {
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    setSocket(null);
    setConnected(false);
  }, []);

  const connect = useCallback(async () => {
    const token = await getAuthToken();
    if (!token || !user?.id) {
      disconnect();
      return;
    }

    // Reuse existing connection when already online
    if (socketRef.current?.connected) {
      setConnected(true);
      return;
    }

    // Drop a stale disconnected socket before creating a new one
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const apiBase = await getActiveApiBaseUrl();
    const next = io(getSocketOrigin(apiBase), {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 12000,
    });

    next.on('connect', () => setConnected(true));
    next.on('disconnect', () => setConnected(false));
    next.on('connect_error', () => setConnected(false));

    socketRef.current = next;
    setSocket(next);
  }, [disconnect, user?.id]);

  useEffect(() => {
    if (loading) return;
    if (!user?.id) {
      disconnect();
      return;
    }
    void connect();
    return () => disconnect();
  }, [user?.id, loading, connect, disconnect]);

  // Reconnect when app returns to foreground
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && user) {
        if (!socketRef.current?.connected) void connect();
        else socketRef.current.emit('ping');
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [connect, user]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

export function useSocketEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  enabled = true
) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !enabled) return undefined;
    const listener = (payload: T) => handler(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event, handler, enabled]);
}
