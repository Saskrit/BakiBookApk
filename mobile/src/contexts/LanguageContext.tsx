import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateProfile } from '../api/auth';
import { useAuth } from './AuthContext';
import {
  detectDeviceLanguage,
  LANGUAGE_STORAGE_KEY,
  setAppLanguage,
} from '../i18n';
import type { AppLanguage } from '../types';

type LanguageContextValue = {
  language: AppLanguage;
  ready: boolean;
  setLanguage: (lang: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, refreshUser } = useAuth();
  const [language, setLanguageState] = useState<AppLanguage>(detectDeviceLanguage());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = (await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)) as AppLanguage | null;
        const initial =
          user?.preferredLanguage === 'ne' || user?.preferredLanguage === 'en'
            ? user.preferredLanguage
            : stored === 'ne' || stored === 'en'
              ? stored
              : detectDeviceLanguage();
        setLanguageState(initial);
        await setAppLanguage(initial);
      } finally {
        setReady(true);
      }
    })();
    // Only on mount — auth sync handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !user?.preferredLanguage) return;
    if (user.preferredLanguage !== language) {
      setLanguageState(user.preferredLanguage);
      void setAppLanguage(user.preferredLanguage);
      void AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, user.preferredLanguage);
    }
  }, [user?.preferredLanguage, ready, language]);

  const setLanguage = useCallback(
    async (lang: AppLanguage) => {
      setLanguageState(lang);
      await setAppLanguage(lang);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      if (user) {
        try {
          await updateProfile({ preferredLanguage: lang });
          await refreshUser();
        } catch {
          // Local language still applied if sync fails
        }
      }
    },
    [user, refreshUser]
  );

  const value = useMemo(
    () => ({ language, ready, setLanguage }),
    [language, ready, setLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
