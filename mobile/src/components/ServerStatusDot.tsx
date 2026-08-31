import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  checkServerStatus,
  getServerStatus,
  subscribeServerStatus,
  type ServerReachability,
} from '../utils/serverStatus';
import { getDeviceOnlineSync, subscribeDeviceNetwork } from '../utils/deviceNetwork';

const COLORS: Record<ServerReachability, string> = {
  checking: '#F59E0B',
  online: '#22C55E',
  offline: '#EF4444',
  'no-internet': '#EF4444',
};

type Props = {
  /** Poll interval while this dot is mounted (login/signup). */
  pollMs?: number;
};

/** Small online/offline indicator for the auth header (left of language toggle). */
export default function ServerStatusDot({ pollMs = 12_000 }: Props) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ServerReachability>(getServerStatus);
  const [deviceOnline, setDeviceOnline] = useState(getDeviceOnlineSync);

  useEffect(() => subscribeServerStatus(setStatus), []);
  useEffect(() => subscribeDeviceNetwork(setDeviceOnline), []);

  useEffect(() => {
    void checkServerStatus({ force: true });
    const id = setInterval(() => {
      void checkServerStatus({ force: true });
    }, pollMs);
    return () => clearInterval(id);
  }, [pollMs]);

  const effectiveStatus: ServerReachability =
    !deviceOnline || status === 'no-internet' ? 'no-internet' : status;

  const label =
    effectiveStatus === 'online'
      ? t('auth.serverOnline')
      : effectiveStatus === 'no-internet'
        ? t('auth.noInternet')
        : effectiveStatus === 'offline'
          ? t('auth.serverOffline')
          : t('auth.serverChecking');

  return (
    <View
      style={[styles.dot, { backgroundColor: COLORS[effectiveStatus] }]}
      accessibilityRole="image"
      accessibilityLabel={label}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
});
