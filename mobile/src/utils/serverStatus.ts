import { getActiveApiBaseUrl } from '../api/client';
import { isDeviceOnline } from './deviceNetwork';

export type ServerReachability = 'checking' | 'online' | 'offline' | 'no-internet';

type Listener = (status: ServerReachability) => void;

let status: ServerReachability = 'checking';
let listeners = new Set<Listener>();
let lastCheckAt = 0;
let inFlight: Promise<boolean> | null = null;

function emit(next: ServerReachability) {
  status = next;
  listeners.forEach((fn) => fn(next));
}

export function getServerStatus(): ServerReachability {
  return status;
}

export function subscribeServerStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(status);
  return () => {
    listeners.delete(listener);
  };
}

async function pingHealth(timeoutMs = 8000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const base = await getActiveApiBaseUrl();
    const response = await fetch(`${base}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) return false;
    const data = (await response.json().catch(() => null)) as { status?: string } | null;
    return Boolean(data && data.status === 'ok');
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Single health check; updates shared online/offline status. */
export async function checkServerStatus(options?: { force?: boolean }): Promise<boolean> {
  const force = Boolean(options?.force);
  const now = Date.now();
  if (!force && inFlight) return inFlight;
  if (!force && now - lastCheckAt < 2500 && status !== 'checking' && status !== 'no-internet') {
    return status === 'online';
  }

  inFlight = (async () => {
    if (!(await isDeviceOnline())) {
      lastCheckAt = Date.now();
      emit('no-internet');
      return false;
    }

    const ok = await pingHealth(8000);
    lastCheckAt = Date.now();
    emit(ok ? 'online' : 'offline');
    return ok;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Keep pinging the API during splash (up to `durationMs`) so TLS/DNS are warm
 * and login/signup hit a ready server.
 */
export async function warmServerDuringSplash(durationMs = 8_000): Promise<boolean> {
  const deadline = Date.now() + durationMs;
  let online = false;

  while (Date.now() < deadline) {
    if (!(await isDeviceOnline())) {
      emit('no-internet');
      const wait = Math.min(1500, deadline - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    online = await pingHealth(Math.min(5000, Math.max(1500, deadline - Date.now())));
    lastCheckAt = Date.now();
    if (online) {
      emit('online');
      const remaining = deadline - Date.now();
      if (remaining > 2500) {
        await new Promise((r) => setTimeout(r, 2000));
        online = (await pingHealth(4000)) || online;
        lastCheckAt = Date.now();
        emit(online ? 'online' : 'offline');
      }
      break;
    }
    emit('offline');
    const wait = Math.min(1500, deadline - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  if (!online && (await isDeviceOnline())) {
    online = await pingHealth(5000);
    lastCheckAt = Date.now();
    emit(online ? 'online' : 'offline');
  } else if (!online && !(await isDeviceOnline())) {
    emit('no-internet');
  }

  return online;
}
