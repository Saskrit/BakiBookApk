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
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../../contexts/AuthContext';
import LoginBackground from '../../components/auth/LoginBackground';
import {
  AuthFooter,
  AuthHeader,
  EmailIcon,
  EyeIcon,
  LockIcon,
  OrDivider,
  UserIcon,
  authStyles,
} from '../../components/auth/AuthUi';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 6 L9 12 L15 18"
        stroke={colors.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function RegisterScreen({ navigation }: Props) {
  const { register, googleSignIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [role, setRole] = useState<'shopkeeper' | 'customer'>('shopkeeper');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError(t('auth.enterFullName'));
      return;
    }
    if (!trimmedEmail) {
      setError(t('auth.enterEmail'));
      return;
    }
    if (!password) {
      setError(t('auth.enterPasswordCreate'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      const user = await register({
        role,
        fullName: trimmedName,
        email: trimmedEmail,
        password,
      });
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      const user = await googleSignIn({ credential, mode: 'register', role });
      navigation.replace(user.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.googleSignUpFailed'));
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
          <Pressable
            onPress={() => navigation.goBack()}
            style={authStyles.backBtn}
            accessibilityLabel={t('auth.goBackToLogin')}
          >
            <BackIcon />
          </Pressable>

          <AuthHeader />

          <View style={authStyles.card}>
            <Text style={authStyles.cardTitle}>{t('auth.registerTitle')}</Text>
            <Text style={authStyles.cardSubtitle}>{t('auth.registerSubtitleCredit')}</Text>
            <Text style={styles.roleHint}>{t('auth.roleOneEmailHint')}</Text>

            {error ? <Text style={authStyles.error}>{error}</Text> : null}

            <Text style={authStyles.label}>{t('auth.chooseRole')}</Text>
            <View style={styles.roleRow}>
              {(['shopkeeper', 'customer'] as const).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                >
                  <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                    {t(`auth.${r}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={authStyles.label}>{t('auth.fullName')}</Text>
            <View style={authStyles.inputRow}>
              <UserIcon />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('auth.placeholderFullName')}
                placeholderTextColor={colors.textMuted}
                style={authStyles.input}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
            </View>

            <Text style={authStyles.label}>{t('auth.emailAddress')}</Text>
            <View style={authStyles.inputRow}>
              <EmailIcon />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.placeholderEmail')}
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
                placeholder={t('auth.placeholderCreatePassword')}
                placeholderTextColor={colors.textMuted}
                style={authStyles.input}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                autoComplete="password-new"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
                accessibilityLabel={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              >
                <EyeIcon visible={showPassword} />
              </Pressable>
            </View>

            <Pressable
              onPress={handleRegister}
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
                  <Text style={authStyles.primaryBtnText}>{t('auth.register')}</Text>
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
              <Text style={authStyles.altText}>{t('auth.hasAccount')} </Text>
              <Pressable onPress={() => navigation.goBack()}>
                <Text style={authStyles.altLink}>{t('auth.loginNow')}</Text>
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
  roleHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 14,
    marginTop: -4,
  },
  roleRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 16,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center' as const,
    backgroundColor: '#FAFAFA',
  },
  roleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleText: {
    fontWeight: '600' as const,
    fontSize: 14,
    color: colors.primaryDark,
  },
  roleTextActive: {
    color: '#FFFFFF',
  },
};
