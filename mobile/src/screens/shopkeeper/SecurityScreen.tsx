import { useCallback, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import {
  changePassword,
  forgotPassword,
  resendVerificationEmail,
} from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import { Button, ErrorText } from '../../components/ui';
import { colors } from '../../theme/colors';
import { typography as ty } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { radius } from '../../theme/radius';

import type { RootStackParamList } from '../../navigation/types';

function SecureField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <View style={secStyles.secFieldWrap}>
      <Text style={secStyles.secFieldLabel}>{label}</Text>
      <View style={secStyles.secSecureRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          style={secStyles.secSecureInput}
        />
        <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} style={secStyles.secEyeBtn}>
          <Text style={secStyles.secEyeText}>{visible ? t('common.hide') : t('common.show')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'muted';
}) {
  const valueColor =
    tone === 'ok' ? colors.primary : tone === 'warn' ? colors.warning : colors.textMuted;
  return (
    <View style={secStyles.secStatusRow}>
      <Text style={secStyles.secStatusLabel}>{label}</Text>
      <Text style={[secStyles.secStatusValue, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function SecurityScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user, logout, refreshUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);

  const isGoogleAccount = user?.authProvider === 'google';
  const needsFirstPassword = isGoogleAccount && !user?.hasPassword;
  const mustChangePassword = Boolean(user?.mustChangePassword);

  useFocusEffect(
    useCallback(() => {
      if (!mustChangePassword) return undefined;
      const onBack = () => true;
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      const unsub = navigation.addListener('beforeRemove', (e) => {
        if (e.data.action.type === 'GO_BACK' || e.data.action.type === 'POP') {
          e.preventDefault();
        }
      });
      return () => {
        sub.remove();
        unsub();
      };
    }, [mustChangePassword, navigation])
  );

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (!needsFirstPassword && !currentPassword.trim()) {
      setError(t('security.enterCurrentPassword'));
      return;
    }
    if (newPassword.length < 6) {
      setError(t('security.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('security.passwordMismatch'));
      return;
    }

    setSaving(true);
    try {
      const res = await changePassword({
        ...(needsFirstPassword ? {} : { currentPassword }),
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(res.message || t('security.passwordChanged'));
      await refreshUser();
      if (mustChangePassword) {
        navigation.navigate(user?.role === 'customer' ? 'Customer' : 'Shopkeeper');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('security.changeFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = () => {
    if (!user?.email) return;
    appAlert(
      t('security.sendResetTitle'),
      t('security.sendResetBody', { email: user.email }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.send'),
          onPress: async () => {
            setSendingReset(true);
            setError('');
            try {
              const res = await forgotPassword(user.email);
              if (res.emailSent === false) {
                appAlert(t('common.error'), res.message || t('security.sendFailed'));
                return;
              }
              appAlert(t('security.emailSent'), res.message, [
                {
                  text: t('common.ok'),
                  onPress: () =>
                    navigation.navigate('ResetPassword', {
                      email: user.email,
                      message: res.message,
                    }),
                },
              ]);
            } catch (err) {
              appAlert(t('common.error'), err instanceof Error ? err.message : t('security.sendFailed'));
            } finally {
              setSendingReset(false);
            }
          },
        },
      ]
    );
  };

  const handleResendVerification = async () => {
    setResendingVerify(true);
    setError('');
    try {
      const res = await resendVerificationEmail();
      appAlert(t('security.verificationEmail'), res.message);
      await refreshUser();
    } catch (err) {
      appAlert(t('common.error'), err instanceof Error ? err.message : t('security.resendFailed'));
    } finally {
      setResendingVerify(false);
    }
  };

  const handleSignOut = () => {
    appAlert(t('security.signOutTitle'), t('security.signOutBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.signOut'),
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <View style={secStyles.secScreen}>
      <LinearGradient
        colors={[colors.primaryDark, colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[secStyles.secHeader, { paddingTop: insets.top + 8 }]}
      >
        <Pressable
          onPress={() => {
            if (!mustChangePassword) navigation.goBack();
          }}
          hitSlop={8}
          disabled={mustChangePassword}
        >
          <Text style={[secStyles.secBack, mustChangePassword && { opacity: 0 }]}>
            {t('common.back')}
          </Text>
        </Pressable>
        <Text style={secStyles.secHeaderTitle}>{t('security.title')}</Text>
        <Text style={secStyles.secHeaderSubtitle}>
          {mustChangePassword ? t('security.mustChangeSubtitle') : t('security.subtitle')}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={secStyles.secFlex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[secStyles.secContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {mustChangePassword ? (
            <View style={secStyles.secMustBanner}>
              <Text style={secStyles.secMustTitle}>{t('security.mustChangeTitle')}</Text>
              <Text style={secStyles.secMustBody}>{t('security.mustChangeBody')}</Text>
            </View>
          ) : null}

          <View style={secStyles.secCard}>
            <Text style={secStyles.secCardTitle}>{t('security.account')}</Text>
            <StatusRow label={t('security.email')} value={user?.email || '—'} />
            <StatusRow
              label={t('security.emailVerified')}
              value={user?.isEmailVerified ? t('security.verified') : t('security.notVerified')}
              tone={user?.isEmailVerified ? 'ok' : 'warn'}
            />
            <StatusRow
              label={t('security.signInMethod')}
              value={isGoogleAccount ? t('security.google') : t('security.emailPassword')}
              tone="muted"
            />
            {!user?.isEmailVerified ? (
              <Button
                title={resendingVerify ? t('common.sending') : t('security.resendVerification')}
                variant="outline"
                onPress={handleResendVerification}
                loading={resendingVerify}
              />
            ) : null}
          </View>

          <View style={secStyles.secCard}>
            <Text style={secStyles.secCardTitle}>
              {needsFirstPassword ? t('security.setPassword') : t('security.changePassword')}
            </Text>
            {needsFirstPassword ? (
              <Text style={secStyles.secHint}>{t('security.googleSetPasswordHint')}</Text>
            ) : null}
            {error ? <ErrorText message={error} /> : null}
            {success ? <Text style={secStyles.secSuccess}>{success}</Text> : null}
            {!needsFirstPassword ? (
              <SecureField
                label={t('security.currentPassword')}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder={t('security.currentPasswordPlaceholder')}
              />
            ) : null}
            <SecureField
              label={needsFirstPassword ? t('security.newPassword') : t('security.newPassword')}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('security.newPasswordPlaceholder')}
            />
            <SecureField
              label={t('security.confirmPassword')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('security.confirmPasswordPlaceholder')}
            />
            <View style={secStyles.secActionRow}>
              <View style={secStyles.secActionHalf}>
                <Button
                  title={t('common.cancel')}
                  variant="outline"
                  onPress={() => {
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setError('');
                    setSuccess('');
                  }}
                  disabled={saving}
                />
              </View>
              <View style={secStyles.secActionHalf}>
                <Button
                  title={
                    saving
                      ? t('common.updating')
                      : needsFirstPassword
                        ? t('security.setPasswordAction')
                        : t('security.updatePassword')
                  }
                  onPress={handleChangePassword}
                  loading={saving}
                />
              </View>
            </View>
          </View>

          <View style={secStyles.secCard}>
            <Text style={secStyles.secCardTitle}>{t('security.passwordReset')}</Text>
            <Text style={secStyles.secHint}>{t('security.resetHint')}</Text>
            <Button
              title={sendingReset ? t('common.sending') : t('security.sendResetEmail')}
              variant="outline"
              onPress={handleForgotPassword}
              loading={sendingReset}
            />
          </View>

          <View style={secStyles.secCard}>
            <View style={secStyles.secTipRow}>
              <View style={secStyles.secTipIcon}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 3 L20 7 V12 C20 17 16.5 20.5 12 21 C7.5 20.5 4 17 4 12 V7 Z"
                    stroke={colors.primary}
                    strokeWidth={2}
                  />
                </Svg>
              </View>
              <Text style={secStyles.secTipText}>{t('security.tip')}</Text>
            </View>
            <Button title={t('security.signOutDevice')} variant="danger" onPress={handleSignOut} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const secStyles = StyleSheet.create({
  secScreen: { flex: 1, backgroundColor: '#F4F5F7' },
  secFlex: { flex: 1 },
  secHeader: {
    paddingHorizontal: spacing.md,
    paddingBottom: 18,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  secBack: { color: 'rgba(255,255,255,0.95)', fontSize: ty.bodyLg, fontWeight: '600', marginBottom: 6 },
  secHeaderTitle: { color: '#FFF', fontSize: ty.h1, fontWeight: '800' },
  secHeaderSubtitle: { color: 'rgba(255,255,255,0.88)', fontSize: ty.body, marginTop: 4 },
  secContent: { padding: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  secMustBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 6,
  },
  secMustTitle: { fontSize: ty.md, fontWeight: '800', color: '#92400E' },
  secMustBody: { fontSize: ty.body, color: '#78350F', lineHeight: 20 },
  secCard: {
    backgroundColor: '#FFF',
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#ECEEF2',
    gap: 10,
  },
  secCardTitle: { fontSize: ty.md, fontWeight: '800', color: colors.text, marginBottom: 4 },
  secStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  secStatusLabel: { fontSize: ty.body, color: colors.textMuted, fontWeight: '600' },
  secStatusValue: { fontSize: ty.body, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 12 },
  secFieldWrap: { marginTop: 4 },
  secFieldLabel: { fontSize: ty.body, fontWeight: '600', color: colors.text, marginBottom: 6 },
  secSecureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
  },
  secSecureInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: ty.md,
    color: colors.text,
  },
  secEyeBtn: { paddingLeft: 8, paddingVertical: 8 },
  secEyeText: { fontSize: ty.caption, fontWeight: '700', color: colors.primary },
  secHint: { fontSize: ty.body, color: colors.textMuted, lineHeight: 18 },
  secSuccess: { fontSize: ty.body, color: colors.primary, fontWeight: '600' },
  secActionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  secActionHalf: { flex: 1 },
  secTipRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', marginBottom: 4 },
  secTipIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secTipText: { flex: 1, fontSize: ty.body, color: colors.textMuted, lineHeight: 18 },
});
