import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import AuthLanguageToggle from '../../components/AuthLanguageToggle';
import AuthKeyboardLayout from '../../components/auth/AuthKeyboardLayout';
import LoginBackground from '../../components/auth/LoginBackground';
import { AuthHeader, EyeIcon, LockIcon, authStyles } from '../../components/auth/AuthUi';
import { forgotPassword, resetPassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import { appAlert } from '../../contexts/DialogContext';
import type { RootStackParamList } from '../../navigation/types';
import { colors, iconSize, radius, spacing, typeScale } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

function BackIcon() {
  return (
    <Svg width={iconSize.lg} height={iconSize.lg} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 6 L9 12 L15 18"
        stroke={colors.primary}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { email, message: initialMessage } = route.params;
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const inputs = useRef<Array<TextInput | null>>([]);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(initialMessage || '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    const timer = setTimeout(() => inputs.current[0]?.focus(), 250);
    return () => clearTimeout(timer);
  }, []);

  const applyDigits = (rawValue: string, startIndex: number) => {
    const pastedDigits = rawValue.replace(/\D/g, '').slice(0, 6 - startIndex);
    if (!pastedDigits) return;

    setDigits((current) => {
      const next = [...current];
      pastedDigits.split('').forEach((digit, offset) => {
        next[startIndex + offset] = digit;
      });
      return next;
    });

    const nextFocus = Math.min(startIndex + pastedDigits.length, 5);
    inputs.current[nextFocus]?.focus();
  };

  const handleSubmit = async () => {
    setError('');
    if (code.length !== 6) {
      setError(t('auth.enterResetCode'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const data = await resetPassword(code, password);
      appAlert(t('auth.resetSuccessTitle'), data.message || t('auth.resetSuccessBody'), [
        {
          text: t('common.ok'),
          onPress: () => navigation.navigate('Login'),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resetFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setMessage('');
    try {
      const data = await forgotPassword(email);
      if (data.emailSent === false) {
        setError(data.message || t('auth.resetEmailFailed'));
      } else {
        setMessage(data.message || t('auth.resetCodeResent'));
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.code === 'EMAIL_NOT_FOUND')) {
        setError(t('auth.emailNotFound'));
      } else {
        setError(err instanceof Error ? err.message : t('auth.resetRequestFailed'));
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={authStyles.container}>
      <StatusBar style="dark" />
      <LoginBackground />

      <View style={[styles.languageToggle, { top: insets.top + spacing.xs }]}>
        <AuthLanguageToggle />
      </View>

      <AuthKeyboardLayout>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
          <BackIcon />
        </Pressable>

        <AuthHeader compact />

        <View style={authStyles.card}>
          <Text style={authStyles.cardTitle}>{t('auth.resetTitle')}</Text>
          <Text style={authStyles.cardSubtitle}>{t('auth.resetSubtitle', { email })}</Text>
          {error ? <Text style={authStyles.error}>{error}</Text> : null}
          {message ? <Text style={styles.info}>{message}</Text> : null}

          <Text style={authStyles.label}>{t('auth.resetCode')}</Text>
          <View style={styles.codeRow}>
            {digits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputs.current[index] = ref;
                }}
                style={styles.codeInput}
                value={digit}
                onChangeText={(value) => {
                  if (!value) {
                    setDigits((current) => {
                      const next = [...current];
                      next[index] = '';
                      return next;
                    });
                    return;
                  }
                  applyDigits(value, index);
                }}
                onKeyPress={({ nativeEvent }) => {
                  if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
                    inputs.current[index - 1]?.focus();
                  }
                }}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                selectTextOnFocus
              />
            ))}
          </View>

          <Text style={authStyles.label}>{t('auth.newPassword')}</Text>
          <View style={authStyles.inputRow}>
            <LockIcon />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.newPasswordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={authStyles.input}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={spacing.sm}>
              <EyeIcon visible={showPassword} />
            </Pressable>
          </View>

          <Text style={authStyles.label}>{t('auth.confirmNewPassword')}</Text>
          <View style={authStyles.inputRow}>
            <LockIcon />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('auth.confirmNewPasswordPlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={authStyles.input}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={spacing.sm}>
              <EyeIcon visible={showConfirm} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [
              authStyles.primaryBtn,
              loading && authStyles.primaryBtnDisabled,
              pressed && authStyles.primaryBtnPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <Text style={authStyles.primaryBtnText}>{t('auth.resetPassword')}</Text>
                <Text style={authStyles.primaryBtnArrow}>→</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={handleResend} disabled={resending} style={styles.resend}>
            <Text style={authStyles.altLink}>
              {resending ? t('common.sending') : t('auth.resendResetCode')}
            </Text>
          </Pressable>
        </View>
      </AuthKeyboardLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  languageToggle: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 2,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: spacing.sm,
  },
  codeInput: {
    flex: 1,
    height: 48,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FAFAFA',
    textAlign: 'center',
    fontSize: typeScale.h2.fontSize,
    fontWeight: '700',
    color: colors.text,
  },
  resend: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
