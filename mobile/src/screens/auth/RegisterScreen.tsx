import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import {
  AuthHeader,
  EmailIcon,
  EyeIcon,
  LockIcon,
  OrDivider,
  PersonRoleIcon,
  StoreIcon,
  UserIcon,
  authStyles,
} from '../../components/auth/AuthUi';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import { useAuth } from '../../contexts/AuthContext';
import type { RootStackParamList } from '../../navigation/types';
import { colors, iconSize, layout, radius, spacing } from '../../theme';
import { warmAuthServices } from '../../utils/warmApi';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
type Role = 'shopkeeper' | 'customer';
type Step = 'role' | 'details';

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

type RoleCardProps = {
  title: string;
  hint: string;
  icon: React.ReactNode;
  onPress: () => void;
};

function RoleCard({ title, hint, icon, onPress }: RoleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.roleCard, pressed && styles.roleCardPressed]}
    >
      <View style={styles.roleIcon}>{icon}</View>
      <View style={styles.roleCopy}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleHint}>{hint}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function RegisterScreen({ navigation }: Props) {
  const { register, googleSignIn } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    warmAuthServices();
  }, []);

  const goBack = () => {
    if (step === 'details') {
      setStep('role');
      setError('');
      return;
    }
    navigation.goBack();
  };

  const chooseRole = (selectedRole: Role) => {
    setRole(selectedRole);
    setError('');
    setStep('details');
  };

  const handleRegister = async () => {
    if (!role) {
      setError(t('auth.chooseRoleFirst'));
      return;
    }

    const normalizedName = fullName.trim();
    const normalizedEmail = email.trim();
    if (!normalizedName) {
      setError(t('auth.enterFullName'));
      return;
    }
    if (!normalizedEmail) {
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
      const result = await register({
        role,
        fullName: normalizedName,
        email: normalizedEmail,
        password,
      });

      if ('requiresVerification' in result && result.requiresVerification) {
        navigation.replace('VerifyEmail', {
          email: normalizedEmail,
          role,
          emailSent: result.emailSent,
          message: result.message,
        });
        return;
      }

      navigation.replace(result.role === 'shopkeeper' ? 'Shopkeeper' : 'Customer');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.registerFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    if (!role) {
      setError(t('auth.chooseRoleFirst'));
      return;
    }

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
          onPress={goBack}
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
        <ScrollView
          style={authStyles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingHorizontal: Math.max(layout.screenPaddingXWide, 20),
              paddingTop: insets.top + layout.touchTarget + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {step === 'role' ? (
            <View style={styles.panel}>
              <AuthHeader compact />
              <Text style={styles.title}>{t('auth.createAccount')}</Text>
              <Text style={styles.subtitle}>{t('auth.chooseRoleSubtitle')}</Text>
              {error ? <Text style={authStyles.error}>{error}</Text> : null}

              <RoleCard
                title={t('auth.shopkeeper')}
                hint={t('auth.shopkeeperRoleHint')}
                icon={<StoreIcon />}
                onPress={() => chooseRole('shopkeeper')}
              />
              <RoleCard
                title={t('auth.customer')}
                hint={t('auth.customerRoleHint')}
                icon={<PersonRoleIcon />}
                onPress={() => chooseRole('customer')}
              />

              <View style={authStyles.altRow}>
                <Text style={authStyles.altText}>{t('auth.hasAccount')} </Text>
                <Pressable onPress={() => navigation.replace('Login')}>
                  <Text style={authStyles.altLink}>{t('auth.loginNow')}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.panel}>
              <AuthHeader compact />
              <Text style={styles.title}>{t('auth.createAccount')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.registerAsRole', { role: t(`auth.${role}`) })}
              </Text>
              {error ? <Text style={authStyles.error}>{error}</Text> : null}

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

              <Text style={authStyles.label}>{t('auth.email')}</Text>
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
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
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
                onPress={handleRegister}
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
                    <Text style={authStyles.primaryBtnText}>{t('auth.signUp')}</Text>
                    <Text style={authStyles.primaryBtnArrow}>→</Text>
                  </>
                )}
              </Pressable>

              <OrDivider />
              <GoogleSignInButton
                onCredential={handleGoogleCredential}
                onError={setError}
                disabled={loading}
              />

              <View style={authStyles.altRow}>
                <Text style={authStyles.altText}>{t('auth.hasAccount')} </Text>
                <Pressable onPress={() => navigation.replace('Login')}>
                  <Text style={authStyles.altLink}>{t('auth.loginNow')}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  panel: {
    width: '100%',
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  roleCard: {
    minHeight: 72,
    marginBottom: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.container,
  },
  roleCardPressed: {
    borderColor: colors.primary,
    backgroundColor: '#F4F7EC',
  },
  roleIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.card,
  },
  roleCopy: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  roleHint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 28,
    fontWeight: '300',
    color: colors.primary,
  },
});
