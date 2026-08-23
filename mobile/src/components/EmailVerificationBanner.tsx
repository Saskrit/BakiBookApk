import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resendVerificationEmail } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { appAlert } from '../contexts/DialogContext';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { User } from '../types';

type Props = {
  user?: User | null;
  compact?: boolean;
};

const RESEND_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export default function EmailVerificationBanner({ user: userProp, compact }: Props) {
  const { t } = useTranslation();
  const { user: authUser, refreshUser } = useAuth();
  const user = userProp ?? authUser;
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.isEmailVerified || user.authProvider === 'google') {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      const data = await withTimeout(resendVerificationEmail(), RESEND_TIMEOUT_MS);
      setSent(true);
      appAlert(
        t('emailBanner.title'),
        data.message || t('emailBanner.linkSent', { email: user.email })
      );
    } catch (err) {
      appAlert(
        t('errors.generic'),
        err instanceof Error ? err.message : t('emailBanner.resendFailed')
      );
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await withTimeout(refreshUser(), RESEND_TIMEOUT_MS);
    } catch (err) {
      appAlert(
        t('errors.generic'),
        err instanceof Error ? err.message : t('errors.generic')
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={[evStyles.evBanner, compact && evStyles.evBannerCompact]}>
      <View style={evStyles.evIconWrap}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 21 C7.5 20.5 4 17 4 12 V7 Z"
            stroke={colors.warning}
            strokeWidth={2}
          />
          <Path
            d="M12 8 V13 M12 16 H12.01"
            stroke={colors.warning}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View style={evStyles.evBody}>
        <Text style={evStyles.evTitle}>{t('emailBanner.title')}</Text>
        <Text style={evStyles.evText}>{t('emailBanner.body', { email: user.email })}</Text>
        <View style={evStyles.evActions}>
          <Pressable
            onPress={handleResend}
            disabled={sending || refreshing}
            style={({ pressed }) => [evStyles.evBtn, pressed && evStyles.evBtnPressed]}
          >
            {sending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={evStyles.evBtnText}>
                {t('emailBanner.resend')}
                {sent ? ' ✓' : ''}
              </Text>
            )}
          </Pressable>
          <Pressable
            onPress={handleRefresh}
            disabled={sending || refreshing}
            style={({ pressed }) => [evStyles.evBtnSecondary, pressed && evStyles.evBtnPressed]}
          >
            {refreshing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Text style={evStyles.evBtnSecondaryText}>{t('emailBanner.refresh')}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const evStyles = StyleSheet.create({
  evBanner: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: 12,
  },
  evBannerCompact: {
    marginHorizontal: 0,
  },
  evIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  evBody: { flex: 1 },
  evTitle: { fontWeight: '800', color: colors.text, marginBottom: 4, fontSize: 15 },
  evText: { color: colors.textMuted, lineHeight: 20, fontSize: 13 },
  evActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  evBtn: {
    alignSelf: 'flex-start',
    minHeight: 36,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  evBtnSecondary: {
    alignSelf: 'flex-start',
    minHeight: 36,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  evBtnPressed: { opacity: 0.85 },
  evBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  evBtnSecondaryText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
});
