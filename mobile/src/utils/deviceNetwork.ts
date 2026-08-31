import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

type Listener = (online: boolean) => void;

let deviceOnline = true;
let listeners = new Set<Listener>();

function readOnline(state: NetInfoState | null): boolean {
  if (!state) return false;
  if (state.isConnected === false || state.isInternetReachable === false) {
    return false;
  }
  return Boolean(state.isConnected);
}

function emit(online: boolean) {
  deviceOnline = online;
  listeners.forEach((fn) => fn(online));
}

let subscribed = false;

function ensureSubscription() {
  if (subscribed) return;
  subscribed = true;
  NetInfo.fetch()
    .then((state) => emit(readOnline(state)))
    .catch(() => emit(false));
  NetInfo.addEventListener((state) => {
    emit(readOnline(state));
  });
}

/** True when the device has an active internet connection. */
export async function isDeviceOnline(): Promise<boolean> {
  ensureSubscription();
  try {
    const state = await NetInfo.fetch();
    const online = readOnline(state);
    deviceOnline = online;
    return online;
  } catch {
    deviceOnline = false;
    return false;
  }
}

export function getDeviceOnlineSync(): boolean {
  ensureSubscription();
  return deviceOnline;
}

export function subscribeDeviceNetwork(listener: Listener): () => void {
  ensureSubscription();
  listeners.add(listener);
  listener(deviceOnline);
  return () => {
    listeners.delete(listener);
  };
}
