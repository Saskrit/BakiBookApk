import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';
import { colors } from '../theme/colors';
import { typography as ty } from '../theme/typography';

import { spacing } from '../theme/spacing';
import { radius } from '../theme/radius';

type MaintenanceContextValue = {
  active: boolean;
  message: string;
  enterMaintenance: (message?: string) => void;
  clearMaintenance: () => void;
  retry: () => Promise<void>;
};

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

let externalEnter: ((message?: string) => void) | null = null;

export function notifyMaintenanceMode(message?: string) {
  externalEnter?.(message);
}

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);

  const enterMaintenance = useCallback(
    (nextMessage?: string) => {
      setMessage(nextMessage || t('maintenance.defaultMessage'));
      setActive(true);
    },
    [t]
  );

  const clearMaintenance = useCallback(() => {
    setActive(false);
    setMessage('');
  }, []);

  const retry = useCallback(async () => {
    if (!API_BASE_URL) {
      clearMaintenance();
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/maintenance-status`);
      const data = await response.json().catch(() => ({}));
      if (response.ok && !data.maintenanceMode) {
        clearMaintenance();
      } else {
        setMessage(data.message || t('maintenance.defaultMessage'));
        setActive(true);
      }
    } catch {
      setMessage(t('maintenance.defaultMessage'));
      setActive(true);
    } finally {
      setChecking(false);
    }
  }, [clearMaintenance, t]);

  externalEnter = enterMaintenance;

  const value = useMemo(
    () => ({
      active,
      message,
      enterMaintenance,
      clearMaintenance,
      retry,
    }),
    [active, message, enterMaintenance, clearMaintenance, retry]
  );

  return (
    <MaintenanceContext.Provider value={value}>
      {children}
      {active ? (
        <View style={[mtStyles.mtOverlay, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <View style={mtStyles.mtCard}>
            <Text style={mtStyles.mtTitle}>{t('maintenance.title')}</Text>
            <Text style={mtStyles.mtBody}>{message || t('maintenance.defaultMessage')}</Text>
            <Pressable
              style={[mtStyles.mtButton, checking && mtStyles.mtButtonDisabled]}
              onPress={() => void retry()}
              disabled={checking}
            >
              <Text style={mtStyles.mtButtonText}>
                {checking ? t('common.loading') : t('maintenance.retry')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance() {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) {
    throw new Error('useMaintenance must be used within MaintenanceProvider');
  }
  return ctx;
}

const mtStyles = StyleSheet.create({
  mtOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(45, 51, 25, 0.92)',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  mtCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.container,
    padding: 22,
    gap: spacing.sm,
  },
  mtTitle: {
    fontSize: ty.h1,
    fontWeight: '800',
    color: colors.text,
  },
  mtBody: {
    fontSize: ty.bodyLg,
    color: colors.textMuted,
    lineHeight: 20,
  },
  mtButton: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mtButtonDisabled: {
    opacity: 0.7,
  },
  mtButtonText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: ty.md,
  },
});
