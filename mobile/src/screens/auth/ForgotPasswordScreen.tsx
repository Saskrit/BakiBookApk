import { useState } from 'react';
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
import { AuthHeader, EmailIcon, authStyles } from '../../components/auth/AuthUi';
import { forgotPassword } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { RootStackParamList } from '../../navigation/types';
import { colors, iconSize, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

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

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError(t('auth.enterEmail'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await forgotPassword(normalized);
      if (data.emailSent === false) {
        setError(data.message || t('auth.resetEmailFailed'));
        return;
      }
      navigation.navigate('ResetPassword', {
        email: normalized,
        message: data.message,
      });
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.code === 'EMAIL_NOT_FOUND')) {
        setError(t('auth.emailNotFound'));
      } else {
        setError(err instanceof Error ? err.message : t('auth.resetRequestFailed'));
      }
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
          <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backBtn}>
            <BackIcon />
          </Pressable>

          <AuthHeader compact />

          <View style={authStyles.card}>
            <Text style={authStyles.cardTitle}>{t('auth.forgotTitle')}</Text>
            <Text style={authStyles.cardSubtitle}>{t('auth.forgotSubtitle')}</Text>
            {error ? <Text style={authStyles.error}>{error}</Text> : null}

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
                returnKeyType="send"
                onSubmitEditing={handleSubmit}
              />
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
                  <Text style={authStyles.primaryBtnText}>{t('auth.sendResetCode')}</Text>
                  <Text style={authStyles.primaryBtnArrow}>→</Text>
                </>
              )}
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
              <Text style={authStyles.altLink}>{t('auth.goBackToLogin')}</Text>
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
  loginLink: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
