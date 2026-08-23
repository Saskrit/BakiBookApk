import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import LoginBackground from '../../components/auth/LoginBackground';
import { AuthHeader, authStyles } from '../../components/auth/AuthUi';
import { useAuth } from '../../contexts/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import {
  colors,
  iconSize,
  layout,
  radius,
  spacing,
  textStyles,
  typeScale,
} from '../../theme';
import { warmAuthServices } from '../../utils/warmApi';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

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

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { email, role } = route.params;
  const { verifyRegistration, resendRegistrationCode } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const inputs = useRef<Array<TextInput | null>>([]);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const code = useMemo(() => digits.join(''), [digits]);

  useEffect(() => {
    warmAuthServices();
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

    const nextIndex = Math.min(startIndex + pastedDigits.length, 5);
    inputs.current[nextIndex]?.focus();
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const numericValue = rawValue.replace(/\D/g, '');
    if (numericValue.length > 1) {
      applyDigits(numericValue, index);
      return;
    }

    const digit = numericValue.slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleVerify = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError(t('auth.enterVerificationCode'));
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    try {
      const user = await verifyRegistration({ email, role, code });
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.verifyFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');
    setResending(true);
    try {
      await resendRegistrationCode({ email, role });
      setDigits(['', '', '', '', '', '']);
      setMessage(t('auth.codeResent'));
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={authStyles.container}>
      <StatusBar style="dark" />
      <LoginBackground />

      <View
        style={[
          styles.topBar,
          {
            top: insets.top + spacing.xxs,
            paddingHorizontal: layout.screenPaddingX,
          },
        ]}
      >
        <Pressable
          onPress={() => navigation.replace('Register')}
          style={authStyles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t('auth.goBackToLogin')}
        >
          <BackIcon />
        </Pressable>
        <AuthLanguageToggle />
      </View>

      <KeyboardAvoidingView
        style={authStyles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[
            authStyles.content,
            {
              paddingTop: insets.top + layout.touchTarget + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
        >
          <AuthHeader compact />
          <View style={authStyles.card}>
            <Text style={styles.title}>{t('auth.verifyEmailTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.verifyEmailSubtitle', { email })}</Text>
            {error ? <Text style={authStyles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}

            <View style={styles.codeRow}>
              {digits.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(input) => {
                    inputs.current[index] = input;
                  }}
                  value={digit}
                  onChangeText={(value) => handleDigitChange(index, value)}
                  onKeyPress={({ nativeEvent }) => {
                    if (nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
                      inputs.current[index - 1]?.focus();
                    }
                  }}
                  style={styles.codeInput}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                  maxLength={index === 0 ? 6 : 1}
                  selectTextOnFocus
                  autoFocus={index === 0}
                  accessibilityLabel={`${t('auth.enterVerificationCode')} ${index + 1}`}
                />
              ))}
            </View>

            <Pressable
              onPress={handleVerify}
              disabled={loading || resending}
              style={({ pressed }) => [
                authStyles.primaryBtn,
                (loading || resending) && authStyles.primaryBtnDisabled,
                pressed && authStyles.primaryBtnPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Text style={authStyles.primaryBtnText}>{t('auth.verifyAndContinue')}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleResend}
              disabled={resending || loading}
              style={styles.resendButton}
            >
              <Text style={styles.resendText}>
                {resending ? t('auth.resendingCode') : t('auth.resendCode')}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...textStyles.h2,
    textAlign: 'center',
    marginBottom: spacing.xxs,
  },
  subtitle: {
    ...textStyles.caption,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  success: {
    ...textStyles.bodySmall,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  codeRow: {
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  codeInput: {
    flex: 1,
    minWidth: 0,
    height: layout.touchTarget + spacing.sm,
    paddingVertical: 0,
    textAlign: 'center',
    backgroundColor: colors.background,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.input,
    ...typeScale.h2,
  },
  resendButton: {
    minHeight: layout.touchTarget,
    marginTop: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendText: {
    ...textStyles.link,
  },
});
