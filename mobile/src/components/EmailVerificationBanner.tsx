import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { resendVerificationEmail } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import { appAlert } from '../contexts/DialogContext';
import { colors } from '../theme/colors';
import type { User } from '../types';

type Props = {
  user?: User | null;
  compact?: boolean;
};

export default function EmailVerificationBanner({ user: userProp, compact }: Props) {
  const { t } = useTranslation();
  const { user: authUser, refreshUser } = useAuth();
  const user = userProp ?? authUser;
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.isEmailVerified || user.authProvider === 'google') {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      const data = await resendVerificationEmail();
      setSent(true);
      appAlert(t('emailBanner.title'), data.message || t('emailBanner.body', { email: user.email }));
      await refreshUser();
    } catch (err) {
      appAlert(
        t('errors.generic'),
        err instanceof Error ? err.message : t('errors.generic'),
      );
    } finally {
      setSending(false);
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
          <Path d="M12 8 V13 M12 16 H12.01" stroke={colors.warning} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>
      <View style={evStyles.evBody}>
        <Text style={evStyles.evTitle}>{t('emailBanner.title')}</Text>
        <Text style={evStyles.evText}>{t('emailBanner.body', { email: user.email })}</Text>
        <Pressable
          onPress={handleResend}
          disabled={sending}
          style={({ pressed }) => [evStyles.evBtn, pressed && evStyles.evBtnPressed]}
        >
          <Text style={evStyles.evBtnText}>
            {sending ? t('common.loading') : t('emailBanner.resend')}
            {sent ? ' ✓' : ''}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const evStyles = StyleSheet.create({
  evBanner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
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
  evTitle: { fontWeight: '800', color: colors.text, marginBottom: 4 },
  evText: { color: colors.textMuted, lineHeight: 20, fontSize: 13 },
  evEmail: { fontWeight: '700', color: colors.text },
  evBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: colors.warning,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  evBtnPressed: { opacity: 0.85 },
  evBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
});
