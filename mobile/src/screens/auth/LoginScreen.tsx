import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { appAlert } from '../../contexts/DialogContext';
import LoginBackground from '../../components/auth/LoginBackground';
import {
  AuthFooter,
  AuthHeader,
  EmailIcon,
  EyeIcon,
  LockIcon,
  OrDivider,
  authStyles,
} from '../../components/auth/AuthUi';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login, googleSignIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [email, setEmail] = useState(__DEV__ ? 'shopkeeper@bakibook.demo' : '');
  const [password, setPassword] = useState(__DEV__ ? 'Demo@123' : '');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('auth.enterEmail'));
      return;
    }
    if (!password) {
      setError(t('auth.enterPassword'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await login(trimmedEmail, password);
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    appAlert(t('auth.forgotPassword'), t('auth.forgotPasswordBody'));
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      const user = await googleSignIn({ credential, mode: 'login' });
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.googleFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={authStyles.container}>
      <StatusBar style="dark" />
      <LoginBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={authStyles.flex}
      >
        <ScrollView
          contentContainerStyle={[
            authStyles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AuthHeader />

          <View style={authStyles.card}>
            <Text style={authStyles.cardTitle}>{t('auth.loginTitle')}</Text>
            <Text style={authStyles.cardSubtitle}>{t('auth.loginSubtitle')}</Text>

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
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                <EyeIcon visible={showPassword} />
              </Pressable>
            </View>

            <Pressable onPress={handleForgotPassword} style={styles.forgotWrap}>
              <Text style={styles.forgotLink}>{t('auth.forgotPassword')}</Text>
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
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={authStyles.primaryBtnText}>{t('auth.signIn')}</Text>
                  <Text style={authStyles.primaryBtnArrow}>→</Text>
                </>
              )}
            </Pressable>

            <OrDivider />

            <GoogleSignInButton
              disabled={loading}
              onCredential={handleGoogleCredential}
              onError={setError}
            />

            <View style={authStyles.altRow}>
              <Text style={authStyles.altText}>{t('auth.noAccount')} </Text>
              <Pressable onPress={() => navigation.navigate('Register')}>
                <Text style={authStyles.altLink}>{t('auth.signUp')}</Text>
              </Pressable>
            </View>
          </View>

          <AuthFooter />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = {
  forgotWrap: {
    alignSelf: 'flex-end' as const,
    marginBottom: 20,
    marginTop: -4,
  },
  forgotLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600' as const,
  },
};
