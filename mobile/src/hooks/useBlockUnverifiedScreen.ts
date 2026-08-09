import { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { appAlert } from '../contexts/DialogContext';
import { needsEmailVerification } from '../utils/authHelpers';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Redirects away from protected write screens when email is not verified. */
export function useBlockUnverifiedScreen(screenLabel: string) {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();

  useFocusEffect(
    useCallback(() => {
      if (!needsEmailVerification(user)) return;

      appAlert(
        t('emailBanner.title'),
        t('emailBanner.body', { email: user?.email || '' }),
        [
          {
            text: t('common.back'),
            style: 'cancel',
            onPress: () => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('Security');
            },
          },
          { text: t('emailBanner.resend'), onPress: () => navigation.navigate('Security') },
        ],
      );
    }, [navigation, screenLabel, t, user]),
  );

  return needsEmailVerification(user);
}
