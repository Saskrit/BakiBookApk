import { useEffect, useState } from 'react';
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
import AuthLanguageToggle from '../../components/AuthLanguageToggle';
import OfflineBanner from '../../components/auth/OfflineBanner';
import AuthKeyboardLayout from '../../components/auth/AuthKeyboardLayout';
import LoginBackground from '../../components/auth/LoginBackground';
import {
  AuthHeader,
  EmailIcon,
  EyeIcon,
  LockIcon,
  OrDivider,
  authStyles,
} from '../../components/auth/AuthUi';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { resendVerificationLink } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import type { RootStackParamList } from '../../navigation/types';
import { colors, spacing, textStyles } from '../../theme';
import { warmAuthServices } from '../../utils/warmApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

function resolveLoginError(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    if (err.code === 'NO_INTERNET') return t('errors.noInternet');
    if (err.code === 'INVALID_EMAIL') return t('auth.invalidEmail');
    if (err.code === 'INVALID_PASSWORD') return t('auth.invalidPassword');
  }
  return err instanceof Error ? err.message : t('auth.loginFailed');
}

export default function LoginScreen({ navigation }: Props) {
  const { login, googleSignIn } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState(__DEV__ ? 'shopkeeper@bakibook.demo' : '');
  const [password, setPassword] = useState(__DEV__ ? 'Demo@123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendingLink, setResendingLink] = useState(false);
  const [showResendLink, setShowResendLink] = useState(false);

  useEffect(() => {
    warmAuthServices();
  }, []);

  const handleLegacyVerification = (err: unknown) => {
    if (!(err instanceof ApiError) || !err.data?.requiresVerification) return false;
    const method = err.data.verificationMethod;
    if (method && method !== 'link') return false;

    setShowResendLink(true);
    const linkSent = Boolean(err.data.linkSent);
    appAlert(
      t('auth.legacyVerifyTitle'),
      linkSent ? t('auth.legacyVerifyLinkSent') : t('auth.legacyVerifyLinkFailed')
    );
    setError(err.message);
    return true;
  };

  const handleResendVerificationLink = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError(t('auth.enterEmailAndPassword'));
      return;
    }
    setResendingLink(true);
    setError('');
    try {
      const data = await resendVerificationLink({
        email: normalizedEmail,
        password,
      });
      appAlert(t('auth.legacyVerifyTitle'), data.message || t('auth.legacyVerifyLinkSent'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.resendLinkFailed'));
    } finally {
      setResendingLink(false);
    }
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError(t('auth.enterEmail'));
      return;
    }
    if (!password) {
      setError(t('auth.enterPassword'));
      return;
    }

    setError('');
    setShowResendLink(false);
    setLoading(true);
    try {
      const user = await login(normalizedEmail, password);
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === 'INVITE_ACTIVATION_REQUIRED' || err.data?.requiresInviteActivation)
      ) {
        navigation.navigate('InviteActivate', {
          email: normalizedEmail,
          message: err.message,
        });
        return;
      }
      if (!handleLegacyVerification(err)) {
        setError(resolveLoginError(err, t));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      const user = await googleSignIn({ credential, mode: 'login' });
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      setError(resolveLoginError(err, t));
    } finally {
      setLoading(false);
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
        <AuthHeader compact />

        <View style={authStyles.card}>
          <Text style={authStyles.cardTitle}>{t('auth.loginTitle')}</Text>
          <Text style={authStyles.cardSubtitle}>{t('auth.loginSubtitle')}</Text>
          <OfflineBanner />
          {error ? <Text style={authStyles.error}>{error}</Text> : null}

          <Text style={authStyles.label}>{t('auth.email')}</Text>
          <View style={authStyles.inputRow}>
            <EmailIcon />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.email')}
              placeholderTextColor={colors.textMuted}
              style={authStyles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <Text style={authStyles.label}>{t('auth.password')}</Text>
          <View style={authStyles.inputRow}>
            <LockIcon />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor={colors.textMuted}
              style={authStyles.input}
              secureTextEntry={!showPassword}
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <Pressable
              onPress={() => setShowPassword((current) => !current)}
              hitSlop={spacing.sm}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            >
              <EyeIcon visible={showPassword} />
            </Pressable>
          </View>

          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotButton}
          >
            <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
          </Pressable>

          <Pressable
            onPress={handleLogin}
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
                <Text style={authStyles.primaryBtnText}>{t('auth.signIn')}</Text>
                <Text style={authStyles.primaryBtnArrow}>→</Text>
              </>
            )}
          </Pressable>

          {showResendLink ? (
            <Pressable
              onPress={handleResendVerificationLink}
              disabled={resendingLink || loading}
              style={styles.resendLinkBtn}
            >
              <Text style={styles.resendLinkText}>
                {resendingLink ? t('auth.resendingLink') : t('auth.resendVerificationLink')}
              </Text>
            </Pressable>
          ) : null}

          <OrDivider />
          <GoogleSignInButton
            onCredential={handleGoogleCredential}
            onError={setError}
            disabled={loading}
          />

          <View style={authStyles.altRow}>
            <Text style={authStyles.altText}>{t('auth.noAccount')} </Text>
            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={authStyles.altLink}>{t('auth.signUp')}</Text>
            </Pressable>
          </View>
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xxs,
    marginBottom: spacing.sm,
  },
  forgotText: {
    ...textStyles.link,
  },
  resendLinkBtn: {
    marginTop: spacing.sm,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  resendLinkText: {
    ...textStyles.link,
    fontWeight: '700',
  },
});
